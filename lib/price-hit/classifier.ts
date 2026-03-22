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

const CLASSIFIER_SYSTEM_PROMPT = `
<role>
You are classifying Polymarket events for a price-hit distribution dashboard.
</role>

<task>
From the provided Polymarket search results for one asset, keep only events that are genuine strike-based price-hit / price-target markets for that same asset.
</task>

<include>
- Events whose child markets are questions like "Will BTC reach $120k?", "Will Gold hit $3,000?", or "Will NVDA touch $150 by March?"
- The same expiry can have many strike markets; keep the parent event once.
</include>

<exclude>
- Non-price markets such as ETFs, earnings, elections, debates, approvals, or company news.
- Markets for a different asset.
- Generic directional markets with no strike target.
- Events where the expiry date cannot be determined confidently from the provided data.
</exclude>

<output_rules>
- Return JSON only.
- Each item must include: asset, eventId, eventSlug, eventTitle, expiryDate.
- expiryDate must be normalized to YYYY-MM-DD.
- Use the exact asset key provided by the user input.
- Do not invent ids or dates that are not strongly supported by the input.
</output_rules>
`.trim();

const structuredEventsSchema = z.array(priceHitStructuredEventSchema);

type SearchResponse = z.infer<typeof gammaPublicSearchResponseSchema>;

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
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_PRICE_HIT_MODEL?.trim() || DEFAULT_MODEL,
        max_output_tokens: 1_000,
        text: {
          format: {
            type: "json_schema",
            name: "price_hit_structured_events",
            strict: true,
            schema: {
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
                    pattern: "^\\d{4}-\\d{2}-\\d{2}$",
                  },
                },
                required: ["asset", "eventId", "eventSlug", "eventTitle", "expiryDate"],
              },
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
      throw new Error(`OpenAI classification request failed with status ${response.status}`);
    }

    const json = await response.json();
    const text = extractResponseText(json);

    if (!text) {
      throw new Error("OpenAI classification response did not contain text output");
    }

    const parsed = structuredEventsSchema.parse(JSON.parse(text));
    return dedupeStructuredEvents(parsed);
  } finally {
    clearTimeout(timeout);
  }
}
