export type TopVolumeEntity = "markets" | "events";
export type TopVolumeWindow = "24h" | "total";
export type TopVolumeKind = "market" | "event";
export type BreakingWindow = "1h" | "24h" | "7d";
export type ItemStatus = "active" | "resolved" | "closed" | "unknown";
export type WatchlistSummaryStatus = "ready" | "unavailable";

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

export type WatchlistResponse = {
  query: string;
  fetchedAt: string;
  summary: string | null;
  summaryStatus: WatchlistSummaryStatus;
  items: WatchlistMarketItem[];
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
  markets?: GammaMarketRaw[] | null;
  tags?: GammaTagRaw[] | null;
  updatedAt?: string | null;
  [key: string]: unknown;
};
