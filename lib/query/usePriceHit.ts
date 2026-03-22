import { useQuery } from "@tanstack/react-query";

import { priceHitResponseSchema } from "@/lib/polymarket/schemas";
import { PriceHitAssetKey, PriceHitResponse } from "@/lib/polymarket/types";
import { queryKeys } from "@/lib/query/keys";

type UsePriceHitParams = {
  asset: PriceHitAssetKey;
};

async function fetchPriceHit(asset: PriceHitAssetKey): Promise<PriceHitResponse> {
  const searchParams = new URLSearchParams({
    asset,
  });

  const response = await fetch(`/api/polymarket/price-hit?${searchParams.toString()}`, {
    method: "GET",
  });

  const json = await response.json();

  if (!response.ok) {
    const message = typeof json?.error?.message === "string" ? json.error.message : "Failed to fetch price hit data";
    throw new Error(message);
  }

  return priceHitResponseSchema.parse(json);
}

export function usePriceHit(params: UsePriceHitParams) {
  return useQuery({
    queryKey: queryKeys.priceHit(params),
    queryFn: () => fetchPriceHit(params.asset),
    staleTime: 0,
    refetchOnMount: "always",
    retry: 1,
    retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 5_000),
  });
}
