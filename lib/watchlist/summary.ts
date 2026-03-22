import "server-only";

import { WatchlistMarketItem, WatchlistSummaryStatus } from "@/lib/polymarket/types";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5-mini";
const REQUEST_TIMEOUT_MS = 12_000;

type WatchlistSummaryResult = {
  text: string | null;
  status: WatchlistSummaryStatus;
};

function buildSnapshot(items: WatchlistMarketItem[]) {
  return items
    .filter((item) => item.yesPrice !== null || item.noPrice !== null || item.lastTradePrice !== null)
    .slice(0, 10)
    .map((item) => ({
      title: item.title,
      yesPrice: item.yesPrice,
      noPrice: item.noPrice,
      lastTradePrice: item.lastTradePrice,
      volume24hUsd: item.volume24hUsd,
      volumeTotalUsd: item.volumeTotalUsd,
    }));
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

export async function generateWatchlistSummary(params: {
  query: string;
  items: WatchlistMarketItem[];
}): Promise<WatchlistSummaryResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const snapshot = buildSnapshot(params.items);

  if (!apiKey || snapshot.length === 0) {
    return {
      text: null,
      status: "unavailable",
    };
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
        model: process.env.OPENAI_WATCHLIST_MODEL?.trim() || DEFAULT_MODEL,
        max_output_tokens: 180,
        input: [
          {
            role: "system",
            content:
              "You write concise Polymarket watchlist summaries. Respond in 2 to 4 sentences. Be analytical rather than descriptive, explain what the market cluster implies about expectations or narrative, note uncertainty when signals are mixed, and avoid financial-advice language. Return plain text only.",
          },
          {
            role: "user",
            content: JSON.stringify(
              {
                topic: params.query,
                markets: snapshot,
              },
              null,
              2,
            ),
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("[watchlist/summary] OpenAI request failed", {
        status: response.status,
      });

      return {
        text: null,
        status: "unavailable",
      };
    }

    const json = await response.json();
    const text = extractResponseText(json);

    if (!text) {
      console.error("[watchlist/summary] OpenAI response did not contain text");

      return {
        text: null,
        status: "unavailable",
      };
    }

    return {
      text,
      status: "ready",
    };
  } catch (error) {
    console.error("[watchlist/summary] failed to generate summary", error);

    return {
      text: null,
      status: "unavailable",
    };
  } finally {
    clearTimeout(timeout);
  }
}
