import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { breakingResponseSchema } from "@/lib/polymarket/schemas";
import { BreakingResponse, BreakingWindow } from "@/lib/polymarket/types";
import { queryKeys } from "@/lib/query/keys";

type UseBreakingParams = {
  window: BreakingWindow;
  limit: number;
  includeTags: string[];
  excludeTags: string[];
};

async function fetchBreaking(params: UseBreakingParams): Promise<BreakingResponse> {
  const searchParams = new URLSearchParams({
    window: params.window,
    limit: String(params.limit),
    includeTags: params.includeTags.join(","),
    excludeTags: params.excludeTags.join(","),
  });

  const response = await fetch(`/api/polymarket/breaking?${searchParams.toString()}`, {
    method: "GET",
  });

  const json = await response.json();

  if (!response.ok) {
    const message = typeof json?.error?.message === "string" ? json.error.message : "Failed to fetch breaking markets";
    throw new Error(message);
  }

  return breakingResponseSchema.parse(json);
}

export function useBreaking(params: UseBreakingParams) {
  return useQuery({
    queryKey: queryKeys.breaking(params),
    queryFn: () => fetchBreaking(params),
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 10_000),
    placeholderData: keepPreviousData,
  });
}
