export type TopVolumeEntity = "markets" | "events";
export type TopVolumeWindow = "24h" | "total";
export type TopVolumeKind = "market" | "event";
export type ItemStatus = "active" | "resolved" | "closed" | "unknown";

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
  active?: boolean | string | number | null;
  closed?: boolean | string | number | null;
  resolved?: boolean | string | number | null;
  volume24hr?: string | number | null;
  volume?: string | number | null;
  volumeNum?: string | number | null;
  lastTradePrice?: string | number | null;
  outcomePrices?: string | Array<string | number> | null;
  tags?: GammaTagRaw[] | null;
  updatedAt?: string | null;
  [key: string]: unknown;
};

export type GammaEventRaw = {
  id?: string | number | null;
  title?: string | null;
  slug?: string | null;
  active?: boolean | string | number | null;
  closed?: boolean | string | number | null;
  resolved?: boolean | string | number | null;
  volume24hr?: string | number | null;
  volume?: string | number | null;
  tags?: GammaTagRaw[] | null;
  updatedAt?: string | null;
  [key: string]: unknown;
};
