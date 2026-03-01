import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { errorResponse } from "@/app/api/polymarket/macro/_shared";
import { MacroSummaryConfigError, MacroSummaryProviderError, generateMacroSummary } from "@/lib/ai/macro-summary";
import { macroSummaryRequestSchema, macroSummaryResponseSchema } from "@/lib/polymarket/macro/schemas";
import { MacroSummaryResponse } from "@/lib/polymarket/macro/types";

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400, { cache: false });
  }

  const parsedBody = macroSummaryRequestSchema.safeParse(body);

  if (!parsedBody.success) {
    return errorResponse("Invalid request payload", 400, { cache: false });
  }

  try {
    const generated = await generateMacroSummary(parsedBody.data);

    const response: MacroSummaryResponse = {
      generatedAt: new Date().toISOString(),
      model: generated.model,
      summary: generated.summary,
    };

    return NextResponse.json(macroSummaryResponseSchema.parse(response));
  } catch (error) {
    if (error instanceof MacroSummaryConfigError) {
      return errorResponse(error.message, 503, { cache: false });
    }

    if (error instanceof MacroSummaryProviderError || error instanceof z.ZodError) {
      console.error("[polymarket/macro/summary] provider or schema failure", error);
      return errorResponse("Failed to generate AI summary.", 502, { cache: false });
    }

    console.error("[polymarket/macro/summary] unexpected route error", error);
    return errorResponse("Failed to generate AI summary.", 500, { cache: false });
  }
}
