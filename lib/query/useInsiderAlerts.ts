import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { insiderAlertsResponseSchema } from "@/lib/insider/schemas";
import { InsiderAlertsResponse } from "@/lib/insider/types";
import { queryKeys } from "@/lib/query/keys";

type UseInsiderAlertsParams = {
  minScore: number;
  limit: number;
  marketId?: string | null;
};

async function fetchInsiderAlerts(params: UseInsiderAlertsParams): Promise<InsiderAlertsResponse> {
  const searchParams = new URLSearchParams({
    minScore: String(params.minScore),
    limit: String(params.limit),
  });

  if (params.marketId) {
    searchParams.set("marketId", params.marketId);
  }

  const response = await fetch(`/api/insider/alerts?${searchParams.toString()}`, {
    method: "GET",
  });

  const json = await response.json();

  if (!response.ok) {
    const message = typeof json?.error?.message === "string" ? json.error.message : "Failed to fetch insider alerts";
    throw new Error(message);
  }

  return insiderAlertsResponseSchema.parse(json);
}

export function useInsiderAlerts(params: UseInsiderAlertsParams) {
  return useQuery({
    queryKey: queryKeys.insiderAlerts({
      minScore: params.minScore,
      limit: params.limit,
      marketId: params.marketId ?? null,
    }),
    queryFn: () => fetchInsiderAlerts(params),
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 10_000),
    placeholderData: keepPreviousData,
  });
}
