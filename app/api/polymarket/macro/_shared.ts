import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { MACRO_DEFAULT_LIMIT, MACRO_MAX_LIMIT } from "@/lib/polymarket/macro/types";

export const macroQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MACRO_MAX_LIMIT).default(MACRO_DEFAULT_LIMIT),
  refresh: z.string().optional(),
});

export function withCacheHeaders(response: NextResponse) {
  response.headers.set("Cache-Control", "s-maxage=15, stale-while-revalidate=30");
  return response;
}

export function parseMacroQuery(request: NextRequest) {
  return macroQuerySchema.safeParse({
    limit: request.nextUrl.searchParams.get("limit") ?? undefined,
    refresh: request.nextUrl.searchParams.get("refresh") ?? undefined,
  });
}

export function errorResponse(message: string, status: number, options?: { upstreamStatus?: number; cache?: boolean }) {
  const payload = {
    error: {
      message,
      ...(typeof options?.upstreamStatus === "number" ? { upstreamStatus: options.upstreamStatus } : {}),
    },
  };

  const response = NextResponse.json(payload, { status });
  return options?.cache === false ? response : withCacheHeaders(response);
}
