import "server-only";

import { z } from "zod";

import { PriceHitAssetConfig } from "@/lib/price-hit/assets";
import { fetchPublicSearch } from "@/lib/polymarket/client";
import { gammaPublicSearchResponseSchema, priceHitStructuredEventSchema } from "@/lib/polymarket/schemas";
import { PriceHitStructuredEvent } from "@/lib/polymarket/types";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5.4-mini";
const REQUEST_TIMEOUT_MS = 18_000;
const SEARCH_LIMIT = 25;
const ASSET_MARKET_ALIASES: Record<PriceHitAssetConfig["key"], RegExp[]> = {
  bitcoin: [/\bbitcoin\b/i, /\bbtc\b/i],
  gold: [/\bgold\b/i, /\bgc\b/i],
  oil: [/\bcrude oil\b/i, /\boil\b/i, /\bcl\b/i],
  nvda: [/\bnvda\b/i, /\bnvidia\b/i],
  silver: [/\bsilver\b/i, /\bsi\b/i],
};

const CLASSIFIER_SYSTEM_PROMPT = `
<role>
You are classifying Polymarket events for a price-hit distribution dashboard.
</role>

<task>
From the provided Polymarket search results for one asset, keep only parent events that are two-sided price-target ladders for that same asset and expiry.
</task>

<include>
- Keep only events whose child markets clearly contain BOTH:
  1. an upside ladder, such as "reach", "touch", or "hit (HIGH)"
  2. a downside ladder, such as "dip to" or "hit (LOW)"
- The wording can vary, but the event must be the same two-sided "what price will X hit by expiry" structure.
- The same expiry can have many strike markets; keep the parent event once.
- Examples to keep:
  - "Will Bitcoin reach $110,000 in March?" together with "Will Bitcoin dip to $65,000 in March?"
  - "Will Gold (GC) hit (HIGH) $4300 by end of March?" together with "Will Gold (GC) hit (LOW) $3000 by end of March?"
  - "Will Crude Oil (CL) hit (HIGH) $180 by end of March?" together with "Will Crude Oil (CL) hit (LOW) $90 by end of March?"
</include>

<exclude>
- Non-price markets such as ETFs, earnings, elections, debates, approvals, or company news.
- Markets for a different asset.
- Generic directional markets with no strike target.
- Events where the expiry date cannot be determined confidently from the provided data.
- Any event that is only one-sided, such as only "reach" markets or only "dip" markets.
- Events built from "above", "below", "settle at", "close above", "close below", "range", "between", or similar settlement/range wording.
- For Bitcoin specifically, reject the extra event families that are not this two-sided ladder structure, even if they contain strike prices.
</exclude>

<output_rules>
- Return JSON only.
- Each item must include: asset, eventId, eventSlug, eventTitle, expiryDate.
- expiryDate must be normalized to YYYY-MM-DD.
- Use the exact asset key provided by the user input.
- Do not invent ids or dates that are not strongly supported by the input.
</output_rules>
`.trim();

const structuredEventsEnvelopeSchema = z.object({
  events: z.array(priceHitStructuredEventSchema),
});

type SearchResponse = z.infer<typeof gammaPublicSearchResponseSchema>;
type SearchEvent = NonNullable<SearchResponse["events"]>[number];
type SearchMarket = NonNullable<SearchEvent["markets"]>[number];

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toString(value: unknown) {
  if (typeof value === "string" && value.trim() !== "") {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function normalizeDateOnly(value: unknown) {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const directDateMatch = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (directDateMatch) {
    return directDateMatch[1];
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function extractResponseText(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.output_text === "string" && record.output_text.trim() !== "") {
    return record.output_text.trim();
  }

  const output = Array.isArray(record.output) ? record.output : [];
  const textParts: string[] = [];

  for (const entry of output) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const message = entry as { type?: unknown; content?: unknown };
    if (message.type !== "message" || !Array.isArray(message.content)) {
      continue;
    }

    for (const contentPart of message.content) {
      if (!contentPart || typeof contentPart !== "object") {
        continue;
      }

      const text = (contentPart as { text?: unknown }).text;
      if (typeof text === "string" && text.trim() !== "") {
        textParts.push(text.trim());
      }
    }
  }

  return textParts.length > 0 ? textParts.join("\n").trim() : null;
}

async function buildOpenAiErrorMessage(response: Response, model: string) {
  const prefix = `OpenAI classification request failed with status ${response.status} for model ${model}`;
  const body = (await response.text()).trim();

  if (!body) {
    return prefix;
  }

  try {
    const parsed = JSON.parse(body) as {
      error?: {
        message?: unknown;
      };
    };
    const message = parsed?.error?.message;
    if (typeof message === "string" && message.trim() !== "") {
      return `${prefix}: ${message.trim()}`;
    }
  } catch {
    // Fall back to the raw text when the error response is not JSON.
  }

  return `${prefix}: ${body.slice(0, 400)}`;
}

function buildSnapshot(asset: PriceHitAssetConfig, rawSearchResponse: SearchResponse) {
  return {
    asset: {
      key: asset.key,
      label: asset.label,
      name: asset.name,
      searchQuery: asset.searchQuery,
    },
    events: (rawSearchResponse.events ?? []).slice(0, SEARCH_LIMIT).map((event) => ({
      eventId: toString(event.id),
      eventSlug: toString(event.slug),
      eventTitle: toString(event.title),
      eventExpiryDate: normalizeDateOnly(event.endDate),
      volume24hUsd: toNumber(event.volume24hr),
      volumeTotalUsd: toNumber(event.volume),
      markets: (event.markets ?? []).slice(0, 16).map((market) => ({
        marketId: toString(market.id),
        marketSlug: toString(market.slug),
        question: toString(market.question),
        title: toString(market.title),
        groupItemTitle: toString(market.groupItemTitle),
        groupItemThreshold: toNumber(market.groupItemThreshold),
        endDate: normalizeDateOnly(market.endDate),
        volume24hUsd: toNumber(market.volume24hr),
        volumeTotalUsd: toNumber(market.volumeNum) ?? toNumber(market.volume),
      })),
    })),
  };
}

function hasPriceLikeStrike(text: string) {
  return /\$\s*[0-9]/i.test(text) || /\b[0-9]{2,3}(?:,[0-9]{3})*(?:\.\d+)?[kKmMbB]?\b/.test(text);
}

function normalizeMarketClassifierText(...values: Array<string | null>) {
  return values
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function classifyPriceHitMarketSide(text: string) {
  if (!text || !hasPriceLikeStrike(text)) {
    return null;
  }

  if (
    /\b(above|below|settle|settles|settlement|close above|close below|closing above|closing below|between|range|band|finish above|finish below)\b/i.test(
      text,
    )
  ) {
    return null;
  }

  if (/\b(dip to|hit\s*\(?low\)?|fall to|falls to|drop to|drops to|low\))\b/i.test(text)) {
    return "low";
  }

  if (/\b(reach|reaches|touch|touches|hit\s*\(?high\)?|high\)|hit)\b/i.test(text)) {
    return "high";
  }

  return null;
}

function textMatchesAsset(asset: PriceHitAssetConfig, text: string) {
  return ASSET_MARKET_ALIASES[asset.key].some((pattern) => pattern.test(text));
}

function isTwoSidedPriceHitEventCandidate(asset: PriceHitAssetConfig, event: SearchEvent) {
  const marketTexts = (event.markets ?? []).map((market: SearchMarket) =>
    normalizeMarketClassifierText(toString(market.question), toString(market.title), toString(market.groupItemTitle)),
  );

  const relevantMarketTexts = marketTexts.filter((text) => textMatchesAsset(asset, text));
  const highCount = relevantMarketTexts.filter((text) => classifyPriceHitMarketSide(text) === "high").length;
  const lowCount = relevantMarketTexts.filter((text) => classifyPriceHitMarketSide(text) === "low").length;

  return highCount >= 2 && lowCount >= 2;
}

function dedupeStructuredEvents(events: PriceHitStructuredEvent[]) {
  const bestByKey = new Map<string, PriceHitStructuredEvent>();

  for (const event of events) {
    const key = `${event.eventId}:${event.expiryDate}`;
    if (!bestByKey.has(key)) {
      bestByKey.set(key, event);
    }
  }

  return Array.from(bestByKey.values()).sort((a, b) => {
    if (a.expiryDate !== b.expiryDate) {
      return a.expiryDate.localeCompare(b.expiryDate);
    }

    return a.eventTitle.localeCompare(b.eventTitle);
  });
}

export async function classifyPriceHitEvents(asset: PriceHitAssetConfig) {
  const rawSearchResponse = await fetchPublicSearch({
    query: asset.searchQuery,
    limit: SEARCH_LIMIT,
    noStore: true,
  });

  const searchResponse = gammaPublicSearchResponseSchema.parse(rawSearchResponse);
  const snapshot = buildSnapshot(asset, searchResponse);
  const candidateEventIds = new Set(
    (searchResponse.events ?? [])
      .filter((event) => isTwoSidedPriceHitEventCandidate(asset, event))
      .map((event) => toString(event.id))
      .filter((eventId): eventId is string => Boolean(eventId)),
  );

  if (snapshot.events.length === 0) {
    return [];
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing required environment variable: OPENAI_API_KEY");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const model = process.env.OPENAI_PRICE_HIT_MODEL?.trim() || DEFAULT_MODEL;
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_output_tokens: 1_000,
        text: {
          format: {
            type: "json_schema",
            name: "price_hit_structured_events",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                events: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      asset: {
                        type: "string",
                        enum: [asset.key],
                      },
                      eventId: {
                        type: "string",
                      },
                      eventSlug: {
                        type: ["string", "null"],
                      },
                      eventTitle: {
                        type: "string",
                      },
                      expiryDate: {
                        type: "string",
                        format: "date",
                      },
                    },
                    required: ["asset", "eventId", "eventSlug", "eventTitle", "expiryDate"],
                  },
                },
              },
              required: ["events"],
            },
          },
        },
        input: [
          {
            role: "system",
            content: CLASSIFIER_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: JSON.stringify(snapshot, null, 2),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(await buildOpenAiErrorMessage(response, model));
    }

    const json = await response.json();
    const text = extractResponseText(json);

    if (!text) {
      throw new Error("OpenAI classification response did not contain text output");
    }

    const parsed = structuredEventsEnvelopeSchema.parse(JSON.parse(text));
    return dedupeStructuredEvents(parsed.events).filter((event) => candidateEventIds.has(event.eventId));
  } finally {
    clearTimeout(timeout);
  }
}
