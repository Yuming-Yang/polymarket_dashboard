import { useMutation } from "@tanstack/react-query";

import { macroSummaryRequestSchema, macroSummaryResponseSchema } from "@/lib/polymarket/macro/schemas";
import { MacroSummaryRequest, MacroSummaryResponse } from "@/lib/polymarket/macro/types";

async function postMacroSummary(input: MacroSummaryRequest): Promise<MacroSummaryResponse> {
  const payload = macroSummaryRequestSchema.parse(input);

  const response = await fetch("/api/polymarket/macro/summary", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const json = await response.json();

  if (!response.ok) {
    const message = typeof json?.error?.message === "string" ? json.error.message : "Failed to generate AI summary";
    throw new Error(message);
  }

  return macroSummaryResponseSchema.parse(json);
}

export function useMacroSummary() {
  return useMutation({
    mutationFn: (input: MacroSummaryRequest) => postMacroSummary(input),
  });
}
