import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { errorResponse, parseMacroQuery, withCacheHeaders } from "@/app/api/polymarket/macro/_shared";
import { enrichCandidatesWithClobChanges } from "@/lib/polymarket/macro/clob";
import { assignMacroBucket, summarizeMacroGroups } from "@/lib/polymarket/macro/grouping";
import { macroResponseSchema } from "@/lib/polymarket/macro/schemas";
import { selectMacroTopMarkets } from "@/lib/polymarket/macro/select";
import { computeMacroStats } from "@/lib/polymarket/macro/stats";
import { MACRO_SOURCE_FETCH_LIMIT, MacroResponse } from "@/lib/polymarket/macro/types";
import { fetchMarketsForBreaking, UpstreamHttpError } from "@/lib/polymarket/client";
import { gammaMarketsSchema } from "@/lib/polymarket/schemas";

export async function GET(request: NextRequest) {
  const parsedQuery = parseMacroQuery(request);

  if (!parsedQuery.success) {
    return errorResponse("Invalid query parameters", 400);
  }

  const { refresh } = parsedQuery.data;

  try {
    const rawMarkets = await fetchMarketsForBreaking({
      limit: MACRO_SOURCE_FETCH_LIMIT,
      noStore: refresh === "1",
    });

    const markets = gammaMarketsSchema.parse(rawMarkets);
    const selected = selectMacroTopMarkets(markets);
    const enriched = await enrichCandidatesWithClobChanges(selected, {
      noStore: refresh === "1",
      concurrency: 10,
    });

    const items = enriched.map((item) => ({
      id: item.candidate.id,
      title: item.candidate.title,
      status: item.candidate.status,
      url: item.candidate.url,
      tags: item.candidate.tags,
      updatedAt: item.candidate.updatedAt,
      volume24hUsd: item.candidate.volume24hUsd,
      expectationProb: item.candidate.expectationProb,
      change1dClob: item.change1dClob,
      change1wClob: item.change1wClob,
      bucket: assignMacroBucket(item.candidate.title, item.candidate.tags),
      clobMeta: item.clobMeta,
    }));

    const response: MacroResponse = {
      params: {
        sourceMarketFetchLimit: MACRO_SOURCE_FETCH_LIMIT,
        includeTagsFixed: ["economy", "finance"],
      },
      fetchedAt: new Date().toISOString(),
      items,
      groups: summarizeMacroGroups(items),
      stats: computeMacroStats(items),
    };

    return withCacheHeaders(NextResponse.json(macroResponseSchema.parse(response)));
  } catch (error) {
    if (error instanceof UpstreamHttpError && error.upstreamStatus === 429) {
      return errorResponse("Upstream rate limit reached. Please retry shortly.", 429, {
        upstreamStatus: error.upstreamStatus,
      });
    }

    if (error instanceof z.ZodError) {
      console.error("[polymarket/macro] upstream payload validation failed", {
        issues: error.issues.slice(0, 3),
      });

      return errorResponse("Upstream payload shape changed. Please retry shortly.", 502);
    }

    console.error("[polymarket/macro] unexpected route error", error);
    return errorResponse("Failed to fetch macro monitor data.", 500);
  }
}
