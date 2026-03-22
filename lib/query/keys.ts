import { BreakingWindow, PriceHitAssetKey, TopVolumeEntity, TopVolumeWindow } from "@/lib/polymarket/types";

type TopVolumeKeyParams = {
  entity: TopVolumeEntity;
  window: TopVolumeWindow;
  limit: number;
  includeTags: string[];
  excludeTags: string[];
};

type BreakingKeyParams = {
  window: BreakingWindow;
  limit: number;
  includeTags: string[];
  excludeTags: string[];
};

type InsiderAlertsKeyParams = {
  minScore: number;
  limit: number;
  marketId: string | null;
};

type WatchlistKeyParams = {
  query: string;
  limit: number;
};

type PriceHitKeyParams = {
  asset: PriceHitAssetKey;
};

export const queryKeys = {
  topVolume: (params: TopVolumeKeyParams) =>
    [
      "top-volume",
      params.entity,
      params.window,
      params.limit,
      params.includeTags.join(","),
      params.excludeTags.join(","),
    ] as const,
  breaking: (params: BreakingKeyParams) =>
    [
      "breaking",
      params.window,
      params.limit,
      params.includeTags.join(","),
      params.excludeTags.join(","),
    ] as const,
  insiderAlerts: (params: InsiderAlertsKeyParams) =>
    ["insider-alerts", params.minScore, params.limit, params.marketId ?? "all"] as const,
  watchlist: (params: WatchlistKeyParams) => ["watchlist", params.query.trim().toLowerCase(), params.limit] as const,
  priceHit: (params: PriceHitKeyParams) => ["price-hit", params.asset] as const,
};
