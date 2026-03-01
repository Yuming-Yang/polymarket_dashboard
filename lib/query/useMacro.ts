import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { macroResponseSchema } from "@/lib/polymarket/macro/schemas";
import { MacroResponse } from "@/lib/polymarket/macro/types";
import { queryKeys } from "@/lib/query/keys";

type UseMacroParams = {
  limit: number;
};

async function fetchMacro(params: UseMacroParams): Promise<MacroResponse> {
  const searchParams = new URLSearchParams({
    limit: String(params.limit),
  });

  const response = await fetch(`/api/polymarket/macro?${searchParams.toString()}`, {
    method: "GET",
  });

  const json = await response.json();

  if (!response.ok) {
    const message = typeof json?.error?.message === "string" ? json.error.message : "Failed to fetch macro monitor data";
    throw new Error(message);
  }

  return macroResponseSchema.parse(json);
}

export function useMacro(params: UseMacroParams) {
  return useQuery({
    queryKey: queryKeys.macro(params),
    queryFn: () => fetchMacro(params),
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 10_000),
    placeholderData: keepPreviousData,
  });
}
