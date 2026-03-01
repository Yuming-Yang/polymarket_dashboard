import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { macroResponseSchema } from "@/lib/polymarket/macro/schemas";
import { MacroResponse } from "@/lib/polymarket/macro/types";
import { queryKeys } from "@/lib/query/keys";

async function fetchMacro(): Promise<MacroResponse> {
  const response = await fetch("/api/polymarket/macro", {
    method: "GET",
  });

  const json = await response.json();

  if (!response.ok) {
    const message = typeof json?.error?.message === "string" ? json.error.message : "Failed to fetch macro monitor data";
    throw new Error(message);
  }

  return macroResponseSchema.parse(json);
}

export function useMacro() {
  return useQuery({
    queryKey: queryKeys.macro(),
    queryFn: fetchMacro,
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 10_000),
    placeholderData: keepPreviousData,
  });
}
