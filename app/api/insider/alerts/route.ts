import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { fetchInsiderAlerts } from "@/lib/insider/supabase";

const querySchema = z.object({
  minScore: z.coerce.number().min(0).max(10).default(6),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  marketId: z.string().trim().optional().transform((value) => (value && value.length > 0 ? value : null)),
});

function withCacheHeaders(response: NextResponse) {
  response.headers.set("Cache-Control", "s-maxage=15, stale-while-revalidate=30");
  return response;
}

export async function GET(request: NextRequest) {
  const parsedQuery = querySchema.safeParse({
    minScore: request.nextUrl.searchParams.get("minScore") ?? undefined,
    limit: request.nextUrl.searchParams.get("limit") ?? undefined,
    marketId: request.nextUrl.searchParams.get("marketId") ?? undefined,
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

  try {
    const response = await fetchInsiderAlerts(parsedQuery.data);
    return withCacheHeaders(NextResponse.json(response));
  } catch (error) {
    console.error("[insider/alerts] failed to fetch alerts", error);

    return withCacheHeaders(
      NextResponse.json(
        {
          error: {
            message: "Failed to fetch insider alerts.",
          },
        },
        { status: 502 },
      ),
    );
  }
}
