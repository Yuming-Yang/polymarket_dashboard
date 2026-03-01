import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { topVolumeResponseSchema } from "@/lib/polymarket/schemas";
import { TopVolumeEntity, TopVolumeResponse, TopVolumeWindow } from "@/lib/polymarket/types";
import { queryKeys } from "@/lib/query/keys";

type UseTopVolumeParams = {
  entity: TopVolumeEntity;
  window: TopVolumeWindow;
  limit: number;
  includeTags: string[];
  excludeTags: string[];
};

async function fetchTopVolume(params: UseTopVolumeParams): Promise<TopVolumeResponse> {
  const searchParams = new URLSearchParams({
    entity: params.entity,
    window: params.window,
    limit: String(params.limit),
    includeTags: params.includeTags.join(","),
    excludeTags: params.excludeTags.join(","),
  });

  const response = await fetch(`/api/polymarket/top-volume?${searchParams.toString()}`, {
    method: "GET",
  });

  const json = await response.json();

  if (!response.ok) {
    const message = typeof json?.error?.message === "string" ? json.error.message : "Failed to fetch top volume data";
    throw new Error(message);
  }

  return topVolumeResponseSchema.parse(json);
}

export function useTopVolume(params: UseTopVolumeParams) {
  return useQuery({
    queryKey: queryKeys.topVolume(params),
    queryFn: () => fetchTopVolume(params),
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 10_000),
    placeholderData: keepPreviousData,
  });
}
