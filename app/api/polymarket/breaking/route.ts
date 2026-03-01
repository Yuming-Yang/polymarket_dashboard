import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { compareByAbsPriceChangeDesc, normalizeBreakingMarkets } from "@/lib/polymarket/breaking";
import { fetchMarketsForBreaking, UpstreamHttpError } from "@/lib/polymarket/client";
import { applyTagFilters, parseTagCsv } from "@/lib/polymarket/filter";
import { gammaMarketsSchema } from "@/lib/polymarket/schemas";
import { BreakingResponse } from "@/lib/polymarket/types";

const querySchema = z.object({
  window: z.enum(["1h", "24h", "7d"]).default("24h"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  includeTags: z.string().optional().default(""),
  excludeTags: z.string().optional().default(""),
  refresh: z.string().optional(),
});

function withCacheHeaders(response: NextResponse) {
  response.headers.set("Cache-Control", "s-maxage=15, stale-while-revalidate=30");
  return response;
}

export async function GET(request: NextRequest) {
  const parsedQuery = querySchema.safeParse({
    window: request.nextUrl.searchParams.get("window") ?? undefined,
    limit: request.nextUrl.searchParams.get("limit") ?? undefined,
    includeTags: request.nextUrl.searchParams.get("includeTags") ?? undefined,
    excludeTags: request.nextUrl.searchParams.get("excludeTags") ?? undefined,
    refresh: request.nextUrl.searchParams.get("refresh") ?? undefined,
  });

  if (!parsedQuery.success) {
    return withCacheHeaders(
      NextResponse.json(
        {
          error: {
            message: "Invalid query parameters",
          },
        },
        { status: 400 },
      ),
    );
  }

  const { window, limit, includeTags, excludeTags, refresh } = parsedQuery.data;
  const includeTagList = parseTagCsv(includeTags);
  const excludeTagList = parseTagCsv(excludeTags);

  try {
    const rawMarkets = await fetchMarketsForBreaking({
      // Notebook section 5 pattern: fetch broad active market set for movers.
      limit: 1_000,
      noStore: refresh === "1",
    });

    const markets = gammaMarketsSchema.parse(rawMarkets);
    const normalizedItems = normalizeBreakingMarkets(markets, window);
    const filteredItems = applyTagFilters(normalizedItems, includeTagList, excludeTagList);
    const sortedItems = filteredItems.sort(compareByAbsPriceChangeDesc);

    const response: BreakingResponse = {
      params: {
        window,
        limit,
        includeTags: includeTagList,
        excludeTags: excludeTagList,
      },
      fetchedAt: new Date().toISOString(),
      items: sortedItems.slice(0, limit),
    };

    return withCacheHeaders(NextResponse.json(response));
  } catch (error) {
    if (error instanceof UpstreamHttpError && error.upstreamStatus === 429) {
      return withCacheHeaders(
        NextResponse.json(
          {
            error: {
              message: "Upstream rate limit reached. Please retry shortly.",
              upstreamStatus: error.upstreamStatus,
            },
          },
          { status: 429 },
        ),
      );
    }

    if (error instanceof z.ZodError) {
      console.error("[polymarket/breaking] upstream payload validation failed", {
        issues: error.issues.slice(0, 3),
      });

      return withCacheHeaders(
        NextResponse.json(
          {
            error: {
              message: "Upstream payload shape changed. Please retry shortly.",
            },
          },
          { status: 502 },
        ),
      );
    }

    console.error("[polymarket/breaking] unexpected route error", error);

    return withCacheHeaders(
      NextResponse.json(
        {
          error: {
            message: "Failed to fetch breaking markets.",
          },
        },
        { status: 502 },
      ),
    );
  }
}
