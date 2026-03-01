import { z } from "zod";

import { macroSummarySchema } from "@/lib/polymarket/macro/schemas";
import { MacroSummaryRequest } from "@/lib/polymarket/macro/types";

const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";

const RESPONSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    takeaway: { type: "string" },
    topRecentChanges: {
      type: "array",
      maxItems: 8,
      items: { type: "string" },
    },
    groupHighlights: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          group: {
            type: "string",
            enum: [
              "Rates & Fed",
              "Inflation",
              "Growth & Labor",
              "Equities & Earnings",
              "Policy & Fiscal",
              "Crypto Macro",
              "Other Economy/Finance",
            ],
          },
          note: { type: "string" },
        },
        required: ["group", "note"],
      },
    },
    watchItems: {
      type: "array",
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          reason: { type: "string" },
        },
        required: ["title", "reason"],
      },
    },
  },
  required: ["takeaway", "topRecentChanges", "groupHighlights", "watchItems"],
} as const;

export class MacroSummaryConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MacroSummaryConfigError";
  }
}

export class MacroSummaryProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MacroSummaryProviderError";
  }
}

function buildSystemPrompt(): string {
  const configured = process.env.OPENAI_MACRO_SUMMARY_PROMPT?.trim();
  if (!configured) {
    throw new MacroSummaryConfigError("AI summary is not configured. Set OPENAI_MACRO_SUMMARY_PROMPT.");
  }

  return configured;
}

function getModel(): string {
  const model = process.env.OPENAI_MODEL?.trim();
  if (!model) {
    throw new MacroSummaryConfigError("AI summary is not configured. Set OPENAI_MODEL.");
  }

  return model;
}

function getApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new MacroSummaryConfigError("AI summary is not configured. Set OPENAI_API_KEY.");
  }

  return apiKey;
}

function extractTextPayload(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    throw new MacroSummaryProviderError("AI response payload is invalid.");
  }

  const candidateText = (payload as { output_text?: unknown }).output_text;
  if (typeof candidateText === "string" && candidateText.trim().length > 0) {
    return candidateText;
  }

  const output = (payload as { output?: unknown }).output;
  if (!Array.isArray(output)) {
    throw new MacroSummaryProviderError("AI response payload has no output.");
  }

  for (const item of output) {
    const content = (item as { content?: unknown })?.content;
    if (!Array.isArray(content)) {
      continue;
    }

    for (const part of content) {
      if (!part || typeof part !== "object") {
        continue;
      }

      const maybeText = (part as { text?: unknown }).text;
      if (typeof maybeText === "string" && maybeText.trim().length > 0) {
        return maybeText;
      }
    }
  }

  throw new MacroSummaryProviderError("AI response did not include text content.");
}

function truncateItemsForPrompt(snapshot: MacroSummaryRequest): MacroSummaryRequest {
  const items = snapshot.items.map((item) => ({
    ...item,
    title: item.title.length > 200 ? `${item.title.slice(0, 197)}...` : item.title,
    tags: item.tags.slice(0, 8),
  }));

  return {
    ...snapshot,
    items,
  };
}

export async function generateMacroSummary(snapshot: MacroSummaryRequest): Promise<{ model: string; summary: z.infer<typeof macroSummarySchema> }> {
  const apiKey = getApiKey();
  const model = getModel();
  const systemPrompt = buildSystemPrompt();
  const compactSnapshot = truncateItemsForPrompt(snapshot);

  const response = await fetch(`${OPENAI_BASE_URL}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: `Summarize this macro monitor snapshot:\n${JSON.stringify(compactSnapshot)}`,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "macro_summary",
          schema: RESPONSE_JSON_SCHEMA,
          strict: true,
        },
      },
      max_output_tokens: 700,
    }),
  });

  if (!response.ok) {
    throw new MacroSummaryProviderError(`AI provider request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  const outputText = extractTextPayload(payload);

  let parsedOutput: unknown;

  try {
    parsedOutput = JSON.parse(outputText);
  } catch {
    throw new MacroSummaryProviderError("AI provider returned non-JSON content.");
  }

  const summary = macroSummarySchema.parse(parsedOutput);

  return {
    model,
    summary,
  };
}
