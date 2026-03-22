import { NextResponse } from "next/server";

import { refreshAllPriceHitAssets } from "@/lib/price-hit/service";

function withNoStoreHeaders(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function POST() {
  try {
    const response = await refreshAllPriceHitAssets();
    return withNoStoreHeaders(NextResponse.json(response, { status: response.ok ? 200 : 502 }));
  } catch (error) {
    console.error("[polymarket/price-hit/refresh] failed to refresh AI cache", error);

    return withNoStoreHeaders(
      NextResponse.json(
        {
          error: {
            message: "Failed to refresh AI price-hit cache.",
          },
        },
        { status: 502 },
      ),
    );
  }
}
