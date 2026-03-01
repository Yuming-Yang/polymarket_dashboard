import { normalizeMarket } from "@/lib/polymarket/normalize";
import { GammaMarketRaw } from "@/lib/polymarket/types";

import { extractCurrentExpectation } from "@/lib/polymarket/macro/expectation";
import { MACRO_MAX_LIMIT } from "@/lib/polymarket/macro/types";

export const MACRO_FIXED_INCLUDE_TAGS = ["economy", "finance"] as const;

export type MacroCandidate = {
  rawMarket: GammaMarketRaw;
  id: string;
  title: string;
  status: "active" | "resolved" | "closed" | "unknown";
  url: string | null;
  tags: string[];
  updatedAt: string | null;
  volume24hUsd: number;
  expectationProb: number | null;
};

function normalizeTag(value: string): string {
  return value.trim().toLowerCase();
}

function hasFixedIncludeTags(tags: string[]): boolean {
  const normalized = new Set(tags.map((tag) => normalizeTag(tag)).filter((tag) => tag.length > 0));

  return MACRO_FIXED_INCLUDE_TAGS.some((tag) => normalized.has(tag));
}

export function selectMacroTopMarkets(rawMarkets: GammaMarketRaw[], limit: number): MacroCandidate[] {
  const normalizedLimit = Math.min(MACRO_MAX_LIMIT, Math.max(1, Math.round(limit)));

  const candidates: MacroCandidate[] = rawMarkets
    .map((rawMarket, index) => {
      const base = normalizeMarket(rawMarket, index);
      return {
        rawMarket,
        id: base.id,
        title: base.title,
        status: base.status,
        url: base.url,
        tags: base.tags,
        updatedAt: base.updatedAt,
        volume24hUsd: base.volume24hUsd,
        expectationProb: extractCurrentExpectation(rawMarket),
      };
    })
    .filter((market): market is MacroCandidate & { volume24hUsd: number } => market.volume24hUsd !== null)
    .filter((market) => market.volume24hUsd > 0)
    .filter((market) => hasFixedIncludeTags(market.tags));

  candidates.sort((left, right) => right.volume24hUsd - left.volume24hUsd);
  return candidates.slice(0, normalizedLimit);
}
