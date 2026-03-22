import { PriceHitAssetKey } from "@/lib/polymarket/types";

export type PriceHitAssetConfig = {
  key: PriceHitAssetKey;
  label: string;
  name: string;
  searchQuery: string;
};

export const PRICE_HIT_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

export const PRICE_HIT_ASSETS: PriceHitAssetConfig[] = [
  {
    key: "bitcoin",
    label: "BTC",
    name: "Bitcoin",
    searchQuery: "Bitcoin",
  },
  {
    key: "gold",
    label: "Gold",
    name: "Gold",
    searchQuery: "Gold",
  },
  {
    key: "oil",
    label: "Oil",
    name: "Oil",
    searchQuery: "Oil",
  },
  {
    key: "nvda",
    label: "NVDA",
    name: "NVDA",
    searchQuery: "NVDA",
  },
  {
    key: "silver",
    label: "Silver",
    name: "Silver",
    searchQuery: "Silver",
  },
];

const assetMap = new Map(PRICE_HIT_ASSETS.map((asset) => [asset.key, asset]));

export function getPriceHitAssetConfig(assetKey: PriceHitAssetKey) {
  return assetMap.get(assetKey) ?? PRICE_HIT_ASSETS[0]!;
}

export function parsePriceHitAssetKey(value: string | null | undefined): PriceHitAssetKey {
  if (value && assetMap.has(value as PriceHitAssetKey)) {
    return value as PriceHitAssetKey;
  }

  return "bitcoin";
}
