import { NextRequest, NextResponse } from "next/server";

import { fetchWalletAlerts } from "@/lib/insider/supabase";

function withCacheHeaders(response: NextResponse) {
  response.headers.set("Cache-Control", "s-maxage=15, stale-while-revalidate=30");
  return response;
}

export async function GET(_request: NextRequest, context: { params: Promise<{ address: string }> }) {
  const { address } = await context.params;
  const normalizedAddress = decodeURIComponent(address).trim().toLowerCase();

  if (!normalizedAddress) {
    return withCacheHeaders(
      NextResponse.json(
        {
          error: {
            message: "Wallet address is required.",
          },
        },
        { status: 400 },
      ),
    );
  }

  try {
    const response = await fetchWalletAlerts(normalizedAddress);
    return withCacheHeaders(NextResponse.json(response));
  } catch (error) {
    console.error("[insider/wallet] failed to fetch wallet alerts", error);

    return withCacheHeaders(
      NextResponse.json(
        {
          error: {
            message: "Failed to fetch wallet alerts.",
          },
        },
        { status: 502 },
      ),
    );
  }
}
