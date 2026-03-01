import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { fetchEvents, fetchMarkets, UpstreamHttpError } from "@/lib/polymarket/client";
import { parseTagCsv, applyTagFilters } from "@/lib/polymarket/filter";
import { normalizeEvents, normalizeMarkets } from "@/lib/polymarket/normalize";
import { gammaEventsSchema, gammaMarketsSchema } from "@/lib/polymarket/schemas";
import { TopVolumeEntity, TopVolumeResponse, TopVolumeWindow } from "@/lib/polymarket/types";
import { compareByDisplayVolumeDesc, withDisplayVolume } from "@/lib/polymarket/volume";

const querySchema = z.object({
  entity: z.enum(["markets", "events"]).default("markets"),
  window: z.enum(["24h", "total"]).default("24h"),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  includeTags: z.string().optional().default(""),
  excludeTags: z.string().optional().default(""),
  refresh: z.string().optional(),
});

function withCacheHeaders(response: NextResponse) {
  response.headers.set("Cache-Control", "s-maxage=15, stale-while-revalidate=30");
  return response;
}

function parseQuery(request: NextRequest) {
  return querySchema.safeParse({
    entity: request.nextUrl.searchParams.get("entity") ?? undefined,
    window: request.nextUrl.searchParams.get("window") ?? undefined,
    limit: request.nextUrl.searchParams.get("limit") ?? undefined,
    includeTags: request.nextUrl.searchParams.get("includeTags") ?? undefined,
    excludeTags: request.nextUrl.searchParams.get("excludeTags") ?? undefined,
    refresh: request.nextUrl.searchParams.get("refresh") ?? undefined,
  });
}

async function fetchSource(entity: TopVolumeEntity, window: TopVolumeWindow, limit: number, refresh: boolean) {
  if (entity === "events") {
    const rawEvents = await fetchEvents({ window, limit, noStore: refresh });
    const events = gammaEventsSchema.parse(rawEvents);
    return normalizeEvents(events);
  }

  const rawMarkets = await fetchMarkets({ window, limit, noStore: refresh });
  const markets = gammaMarketsSchema.parse(rawMarkets);
  return normalizeMarkets(markets);
}

export async function GET(request: NextRequest) {
  const parsedQuery = parseQuery(request);

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

  const { entity, window, limit, includeTags, excludeTags, refresh } = parsedQuery.data;

  const includeTagList = parseTagCsv(includeTags);
  const excludeTagList = parseTagCsv(excludeTags);

  try {
    const normalizedItems = await fetchSource(entity, window, limit, refresh === "1");

    const filteredItems = applyTagFilters(normalizedItems, includeTagList, excludeTagList);
    const sortedItems = withDisplayVolume(filteredItems, window).sort(compareByDisplayVolumeDesc);

    const response: TopVolumeResponse = {
      params: {
        entity,
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
      console.error("[polymarket/top-volume] upstream payload validation failed", {
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

    console.error("[polymarket/top-volume] unexpected route error", error);

    return withCacheHeaders(
      NextResponse.json(
        {
          error: {
            message: "Failed to fetch top volume data.",
          },
        },
        { status: 502 },
      ),
    );
  }
}
