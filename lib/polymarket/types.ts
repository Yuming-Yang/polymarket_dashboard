export type TopVolumeEntity = "markets" | "events";
export type TopVolumeWindow = "24h" | "total";
export type TopVolumeKind = "market" | "event";
export type BreakingWindow = "1h" | "24h" | "7d";
export type ItemStatus = "active" | "resolved" | "closed" | "unknown";
export type WatchlistSummaryStatus = "ready" | "unavailable";
export type PriceHitAssetKey = "bitcoin" | "gold" | "oil" | "nvda" | "silver";
export type PriceHitAiCacheStatus = "cache_hit" | "refreshed" | "stale_fallback";
export type PriceHitBucketKind = "lower" | "interior" | "upper";
export type PriceHitMarketSide = "low" | "high";

export type TopVolumeParams = {
  entity: TopVolumeEntity;
  window: TopVolumeWindow;
  limit: number;
  includeTags: string[];
  excludeTags: string[];
};

export type TopVolumeItem = {
  kind: TopVolumeKind;
  id: string;
  title: string;
  status: ItemStatus;
  volume24hUsd: number | null;
  volumeTotalUsd: number | null;
  displayVolumeUsd: number | null;
  price: number | null;
  url: string | null;
  tags: string[];
  updatedAt: string | null;
};

export type TopVolumeResponse = {
  params: TopVolumeParams;
  fetchedAt: string;
  items: TopVolumeItem[];
};

export type BreakingParams = {
  window: BreakingWindow;
  limit: number;
  includeTags: string[];
  excludeTags: string[];
};

export type BreakingItem = {
  id: string;
  title: string;
  status: ItemStatus;
  window: BreakingWindow;
  priceChange: number | null;
  absPriceChange: number | null;
  lastPrice: number | null;
  volume24hUsd: number | null;
  tags: string[];
  url: string | null;
  updatedAt: string | null;
};

export type BreakingResponse = {
  params: BreakingParams;
  fetchedAt: string;
  items: BreakingItem[];
};

export type WatchlistMarketItem = {
  id: string;
  title: string;
  yesPrice: number | null;
  noPrice: number | null;
  lastTradePrice: number | null;
  volume24hUsd: number | null;
  volumeTotalUsd: number | null;
  url: string | null;
  status: ItemStatus;
  updatedAt: string | null;
};

export type WatchlistEventItem = {
  id: string;
  title: string;
  url: string | null;
  status: ItemStatus;
  volume24hUsd: number | null;
  volumeTotalUsd: number | null;
  marketCount: number;
  updatedAt: string | null;
  markets: WatchlistMarketItem[];
};

export type WatchlistResponse = {
  query: string;
  fetchedAt: string;
  summary: string | null;
  summaryStatus: WatchlistSummaryStatus;
  events: WatchlistEventItem[];
};

export type PriceHitStructuredEvent = {
  asset: PriceHitAssetKey;
  eventId: string;
  eventSlug: string | null;
  eventTitle: string;
  expiryDate: string;
};

export type PriceHitMarketItem = {
  marketId: string;
  eventId: string;
  eventTitle: string;
  title: string;
  side: PriceHitMarketSide;
  strikePrice: number;
  probability: number;
  volume24hUsd: number | null;
  volumeTotalUsd: number | null;
  url: string | null;
  updatedAt: string | null;
};

export type PriceHitDistributionBucket = {
  key: string;
  kind: PriceHitBucketKind;
  startPrice: number;
  endPrice: number;
  centerPrice: number;
  probabilityDensity: number;
  label: string;
};

export type PriceHitExpiryDistribution = {
  expiryDate: string;
  eventId: string;
  eventTitle: string;
  strikeCount: number;
  impliedMedianPrice: number | null;
  range90Low: number | null;
  range90High: number | null;
  chartMinPrice: number;
  chartMaxPrice: number;
  strikePrices: number[];
  buckets: PriceHitDistributionBucket[];
  markets: PriceHitMarketItem[];
};

export type PriceHitResponse = {
  asset: PriceHitAssetKey;
  assetLabel: string;
  assetName: string;
  fetchedAt: string;
  aiCacheStatus: PriceHitAiCacheStatus;
  aiRefreshedAt: string | null;
  aiExpiresAt: string | null;
  structuredEventCount: number;
  defaultExpiry: string | null;
  expiries: PriceHitExpiryDistribution[];
};

export type PriceHitRefreshAssetResult = {
  asset: PriceHitAssetKey;
  assetLabel: string;
  ok: boolean;
  status: "refreshed" | "stale_fallback" | "failed";
  structuredEventCount: number;
  refreshedAt: string | null;
  expiresAt: string | null;
  message: string | null;
};

export type PriceHitRefreshResponse = {
  fetchedAt: string;
  ok: boolean;
  results: PriceHitRefreshAssetResult[];
};

export type GammaTagRaw = {
  id?: string | number | null;
  label?: string | null;
  [key: string]: unknown;
};

export type GammaMarketRaw = {
  id?: string | number | null;
  question?: string | null;
  title?: string | null;
  slug?: string | null;
  groupItemTitle?: string | null;
  groupItemThreshold?: string | number | null;
  score?: string | number | null;
  active?: boolean | string | number | null;
  closed?: boolean | string | number | null;
  resolved?: boolean | string | number | null;
  volume24hr?: string | number | null;
  volume?: string | number | null;
  volumeNum?: string | number | null;
  oneHourPriceChange?: string | number | null;
  oneDayPriceChange?: string | number | null;
  oneWeekPriceChange?: string | number | null;
  oneMonthPriceChange?: string | number | null;
  lastTradePrice?: string | number | null;
  outcomes?: string | Array<string | null> | null;
  outcomePrices?: string | Array<string | number> | null;
  clobTokenIds?: string | Array<string | number> | null;
  tags?: GammaTagRaw[] | null;
  updatedAt?: string | null;
  endDate?: string | null;
  [key: string]: unknown;
};

export type GammaEventRaw = {
  id?: string | number | null;
  title?: string | null;
  slug?: string | null;
  score?: string | number | null;
  active?: boolean | string | number | null;
  closed?: boolean | string | number | null;
  resolved?: boolean | string | number | null;
  volume24hr?: string | number | null;
  volume?: string | number | null;
  endDate?: string | null;
  markets?: GammaMarketRaw[] | null;
  tags?: GammaTagRaw[] | null;
  updatedAt?: string | null;
  [key: string]: unknown;
};
