import { BreakingItem, BreakingWindow, GammaMarketRaw } from "@/lib/polymarket/types";
import { normalizeMarket } from "@/lib/polymarket/normalize";

const windowFieldCandidates: Record<BreakingWindow, string[]> = {
  "1h": ["oneHourPriceChange", "hourPriceChange", "priceChange1h"],
  "24h": ["oneDayPriceChange", "priceChange24h"],
  "7d": ["oneWeekPriceChange", "sevenDayPriceChange", "priceChange7d"],
};

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function extractWindowPriceChange(rawMarket: GammaMarketRaw, window: BreakingWindow): number | null {
  const fields = windowFieldCandidates[window];

  for (const field of fields) {
    const value = toNumber((rawMarket as Record<string, unknown>)[field]);
    if (value !== null) {
      return value;
    }
  }

  return null;
}

export function normalizeBreakingMarkets(rawMarkets: GammaMarketRaw[], window: BreakingWindow): BreakingItem[] {
  return rawMarkets.map((rawMarket, index) => {
    const base = normalizeMarket(rawMarket, index);
    const priceChange = extractWindowPriceChange(rawMarket, window);

    return {
      id: base.id,
      title: base.title,
      status: base.status,
      window,
      priceChange,
      absPriceChange: priceChange === null ? null : Math.abs(priceChange),
      lastPrice: base.price,
      volume24hUsd: base.volume24hUsd,
      tags: base.tags,
      url: base.url,
      updatedAt: base.updatedAt,
    };
  });
}

export function compareByAbsPriceChangeDesc(left: BreakingItem, right: BreakingItem) {
  const a = left.absPriceChange ?? Number.NEGATIVE_INFINITY;
  const b = right.absPriceChange ?? Number.NEGATIVE_INFINITY;

  return b - a;
}
