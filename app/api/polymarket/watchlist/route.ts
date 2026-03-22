import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { fetchPublicSearch, UpstreamHttpError } from "@/lib/polymarket/client";
import { WatchlistResponse } from "@/lib/polymarket/types";
import { normalizeWatchlistMarkets } from "@/lib/polymarket/watchlist";
import { generateWatchlistSummary } from "@/lib/watchlist/summary";

const querySchema = z.object({
  q: z.string().trim().min(1).max(80),
  limit: z.coerce.number().int().min(1).max(24).default(12),
  refresh: z.string().optional(),
});

function withCacheHeaders(response: NextResponse) {
  response.headers.set("Cache-Control", "s-maxage=15, stale-while-revalidate=30");
  return response;
}

export async function GET(request: NextRequest) {
  const parsedQuery = querySchema.safeParse({
    q: request.nextUrl.searchParams.get("q") ?? undefined,
    limit: request.nextUrl.searchParams.get("limit") ?? undefined,
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

  const { q, limit, refresh } = parsedQuery.data;

  try {
    const rawSearchResponse = await fetchPublicSearch({
      query: q,
      limit: Math.max(limit, 12),
      noStore: refresh === "1",
    });

    const items = normalizeWatchlistMarkets(rawSearchResponse).slice(0, limit);
    const summary = await generateWatchlistSummary({
      query: q,
      items,
    });

    const response: WatchlistResponse = {
      query: q,
      fetchedAt: new Date().toISOString(),
      summary: summary.text,
      summaryStatus: summary.status,
      items,
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
      console.error("[polymarket/watchlist] upstream payload validation failed", {
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

    console.error("[polymarket/watchlist] unexpected route error", error);

    return withCacheHeaders(
      NextResponse.json(
        {
          error: {
            message: "Failed to fetch watchlist results.",
          },
        },
        { status: 502 },
      ),
    );
  }
}
