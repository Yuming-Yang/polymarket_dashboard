import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getPriceHitData } from "@/lib/price-hit/service";

const querySchema = z.object({
  asset: z.enum(["bitcoin", "gold", "oil", "nvda", "silver"]).default("bitcoin"),
});

function withNoStoreHeaders(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET(request: NextRequest) {
  const parsedQuery = querySchema.safeParse({
    asset: request.nextUrl.searchParams.get("asset") ?? undefined,
  });

  if (!parsedQuery.success) {
    return withNoStoreHeaders(
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
    const response = await getPriceHitData(parsedQuery.data.asset);
    return withNoStoreHeaders(NextResponse.json(response));
  } catch (error) {
    console.error("[polymarket/price-hit] failed to fetch price hit data", error);

    return withNoStoreHeaders(
      NextResponse.json(
        {
          error: {
            message: "Failed to fetch price hit data.",
          },
        },
        { status: 502 },
      ),
    );
  }
}
