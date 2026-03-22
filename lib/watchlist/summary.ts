import "server-only";

import { WatchlistEventItem, WatchlistSummaryStatus } from "@/lib/polymarket/types";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5.4-mini";
const REQUEST_TIMEOUT_MS = 12_000;
const WATCHLIST_SYSTEM_PROMPT = `
<role>
你是一个 Polymarket 主题观察分析师。你的任务不是逐条复述市场，而是从一组相关事件和子市场中提炼出“市场整体在押注什么”。
</role>

<goal>
基于给定的 topic 与 events 数据，写一段面向中文用户的高信息密度摘要，解释这些市场共同反映出的预期、分歧、叙事方向与不确定性。
</goal>

<writing_controls>
- 仅使用简体中文。
- 目标是 3 到 5 句；如果信息密度确实需要，可以写到 6 句，但保持紧凑。
- 只输出正文，不要标题、项目符号、Markdown、引号、前言或结尾客套话。
- 语气冷静、专业、分析型，像交易台晨会摘要，不要夸张。
- 第一语句先给最高信号结论，后面再补充分歧、条件或不确定性。
</writing_controls>

<analysis_rules>
- 以事件层做综合判断，不要把每个子市场逐条复述一遍。
- 优先关注概率高低、多个子市场是否一致、不同事件之间是否共振、成交量是否集中。
- 如果某个事件或某类结果在成交量或定价上明显主导整体判断，要点明这一点。
- 如果信号分裂、事件之间指向不同、或数据稀薄，要明确写出市场分歧较大或当前信号有限，并简短说明原因。
- 可以提到最关键的 1 到 2 个市场方向，但不要变成列表。
- 除非数字明显强化结论，否则不要堆砌原始数字。
- 更关注市场意味着什么，而不是市场显示了什么。
</analysis_rules>

<forbidden>
- 不要逐条总结所有标题。
- 不要给投资建议、交易建议或收益判断。
- 不要说“作为 AI”。
- 不要编造输入中没有的信息。
</forbidden>

<done_criteria>
读者看完后，应能立刻明白：这个主题下，市场总体更偏向什么、最重要的分歧在哪里、当前叙事是集中还是分散。
</done_criteria>
`.trim();

type WatchlistSummaryResult = {
  text: string | null;
  status: WatchlistSummaryStatus;
};

function buildSnapshot(events: WatchlistEventItem[]) {
  return events
    .filter((event) => event.markets.some((market) => market.yesPrice !== null || market.noPrice !== null || market.lastTradePrice !== null))
    .slice(0, 8)
    .map((event) => ({
      eventTitle: event.title,
      volume24hUsd: event.volume24hUsd,
      volumeTotalUsd: event.volumeTotalUsd,
      marketCount: event.marketCount,
      markets: event.markets.slice(0, 10).map((market) => ({
        title: market.title,
        yesPrice: market.yesPrice,
        noPrice: market.noPrice,
        lastTradePrice: market.lastTradePrice,
        volume24hUsd: market.volume24hUsd,
        volumeTotalUsd: market.volumeTotalUsd,
      })),
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
  events: WatchlistEventItem[];
}): Promise<WatchlistSummaryResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const snapshot = buildSnapshot(params.events);

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
        max_output_tokens: 320,
        text: {
          verbosity: "medium",
        },
        input: [
          {
            role: "system",
            content: WATCHLIST_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: JSON.stringify(
              {
                topic: params.query,
                events: snapshot,
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
