import { useQuery } from "@tanstack/react-query";

import { watchlistResponseSchema } from "@/lib/polymarket/schemas";
import { WatchlistResponse } from "@/lib/polymarket/types";
import { queryKeys } from "@/lib/query/keys";

type UseWatchlistParams = {
  query: string;
  limit: number;
};

async function fetchWatchlist(params: UseWatchlistParams): Promise<WatchlistResponse> {
  const searchParams = new URLSearchParams({
    q: params.query,
    limit: String(params.limit),
  });

  const response = await fetch(`/api/polymarket/watchlist?${searchParams.toString()}`, {
    method: "GET",
  });

  const json = await response.json();

  if (!response.ok) {
    const message = typeof json?.error?.message === "string" ? json.error.message : "Failed to fetch watchlist results";
    throw new Error(message);
  }

  return watchlistResponseSchema.parse(json);
}

export function useWatchlist(params: UseWatchlistParams) {
  return useQuery({
    queryKey: queryKeys.watchlist(params),
    queryFn: () => fetchWatchlist(params),
    enabled: params.query.trim().length > 0,
    staleTime: 15_000,
    retry: 1,
    retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 5_000),
  });
}
