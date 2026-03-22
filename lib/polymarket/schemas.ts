import { z } from "zod";

const numberLikeSchema = z.union([z.number(), z.string()]).nullable().optional();
const boolLikeSchema = z.union([z.boolean(), z.string(), z.number()]).nullable().optional();

export const gammaTagSchema = z
  .object({
    id: z.union([z.string(), z.number()]).nullable().optional(),
    label: z.string().nullable().optional(),
  })
  .passthrough();

export const gammaMarketSchema = z
  .object({
    id: z.union([z.string(), z.number()]).nullable().optional(),
    question: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
    slug: z.string().nullable().optional(),
    groupItemTitle: z.string().nullable().optional(),
    groupItemThreshold: numberLikeSchema,
    score: numberLikeSchema,
    active: boolLikeSchema,
    closed: boolLikeSchema,
    resolved: boolLikeSchema,
    volume24hr: numberLikeSchema,
    volume: numberLikeSchema,
    volumeNum: numberLikeSchema,
    oneHourPriceChange: numberLikeSchema,
    oneDayPriceChange: numberLikeSchema,
    oneWeekPriceChange: numberLikeSchema,
    oneMonthPriceChange: numberLikeSchema,
    lastTradePrice: numberLikeSchema,
    outcomes: z.union([z.string(), z.array(z.string().nullable())]).nullable().optional(),
    outcomePrices: z.union([z.string(), z.array(z.union([z.string(), z.number()]))]).nullable().optional(),
    clobTokenIds: z.union([z.string(), z.array(z.union([z.string(), z.number()]))]).nullable().optional(),
    tags: z.array(gammaTagSchema).nullable().optional(),
    updatedAt: z.string().nullable().optional(),
    endDate: z.string().nullable().optional(),
  })
  .passthrough();

export const gammaEventSchema = z
  .object({
    id: z.union([z.string(), z.number()]).nullable().optional(),
    title: z.string().nullable().optional(),
    slug: z.string().nullable().optional(),
    score: numberLikeSchema,
    active: boolLikeSchema,
    closed: boolLikeSchema,
    resolved: boolLikeSchema,
    volume24hr: numberLikeSchema,
    volume: numberLikeSchema,
    endDate: z.string().nullable().optional(),
    markets: z.array(gammaMarketSchema).nullable().optional(),
    tags: z.array(gammaTagSchema).nullable().optional(),
    updatedAt: z.string().nullable().optional(),
  })
  .passthrough();

export const gammaMarketsSchema = z.array(gammaMarketSchema);
export const gammaEventsSchema = z.array(gammaEventSchema);
export const gammaPublicSearchResponseSchema = z
  .object({
    events: z.array(gammaEventSchema).optional(),
  })
  .passthrough();

export const topVolumeItemSchema = z.object({
  kind: z.enum(["market", "event"]),
  id: z.string(),
  title: z.string(),
  status: z.enum(["active", "resolved", "closed", "unknown"]),
  volume24hUsd: z.number().nullable(),
  volumeTotalUsd: z.number().nullable(),
  displayVolumeUsd: z.number().nullable(),
  price: z.number().nullable(),
  url: z.string().nullable(),
  tags: z.array(z.string()),
  updatedAt: z.string().nullable(),
});

export const topVolumeResponseSchema = z.object({
  params: z.object({
    entity: z.enum(["markets", "events"]),
    window: z.enum(["24h", "total"]),
    limit: z.number().int().positive(),
    includeTags: z.array(z.string()),
    excludeTags: z.array(z.string()),
  }),
  fetchedAt: z.string(),
  items: z.array(topVolumeItemSchema),
});

export const breakingItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(["active", "resolved", "closed", "unknown"]),
  window: z.enum(["1h", "24h", "7d"]),
  priceChange: z.number().nullable(),
  absPriceChange: z.number().nullable(),
  lastPrice: z.number().nullable(),
  volume24hUsd: z.number().nullable(),
  tags: z.array(z.string()),
  url: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export const breakingResponseSchema = z.object({
  params: z.object({
    window: z.enum(["1h", "24h", "7d"]),
    limit: z.number().int().positive(),
    includeTags: z.array(z.string()),
    excludeTags: z.array(z.string()),
  }),
  fetchedAt: z.string(),
  items: z.array(breakingItemSchema),
});

export const watchlistMarketItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  yesPrice: z.number().nullable(),
  noPrice: z.number().nullable(),
  lastTradePrice: z.number().nullable(),
  volume24hUsd: z.number().nullable(),
  volumeTotalUsd: z.number().nullable(),
  url: z.string().nullable(),
  status: z.enum(["active", "resolved", "closed", "unknown"]),
  updatedAt: z.string().nullable(),
});

export const watchlistEventItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string().nullable(),
  status: z.enum(["active", "resolved", "closed", "unknown"]),
  volume24hUsd: z.number().nullable(),
  volumeTotalUsd: z.number().nullable(),
  marketCount: z.number().int().nonnegative(),
  updatedAt: z.string().nullable(),
  markets: z.array(watchlistMarketItemSchema),
});

export const watchlistResponseSchema = z.object({
  query: z.string(),
  fetchedAt: z.string(),
  summary: z.string().nullable(),
  summaryStatus: z.enum(["ready", "unavailable"]),
  events: z.array(watchlistEventItemSchema),
});

export const priceHitAssetKeySchema = z.enum(["bitcoin", "gold", "oil", "nvda", "silver"]);
export const priceHitAiCacheStatusSchema = z.enum(["cache_hit", "refreshed", "stale_fallback"]);
export const priceHitStructuredEventSchema = z.object({
  asset: priceHitAssetKeySchema,
  eventId: z.string(),
  eventSlug: z.string().nullable(),
  eventTitle: z.string(),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const priceHitMarketItemSchema = z.object({
  marketId: z.string(),
  eventId: z.string(),
  eventTitle: z.string(),
  title: z.string(),
  side: z.enum(["low", "high"]),
  strikePrice: z.number(),
  probability: z.number().min(0).max(1),
  volume24hUsd: z.number().nullable(),
  volumeTotalUsd: z.number().nullable(),
  url: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export const priceHitDistributionBucketSchema = z.object({
  key: z.string(),
  kind: z.enum(["lower", "interior", "upper"]),
  startPrice: z.number(),
  endPrice: z.number(),
  centerPrice: z.number(),
  probabilityDensity: z.number().min(0).max(1),
  label: z.string(),
});

export const priceHitEventDistributionSchema = z.object({
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  eventId: z.string(),
  eventTitle: z.string(),
  strikeCount: z.number().int().min(0),
  impliedMedianPrice: z.number().nullable(),
  range90Low: z.number().nullable(),
  range90High: z.number().nullable(),
  chartMinPrice: z.number(),
  chartMaxPrice: z.number(),
  strikePrices: z.array(z.number()),
  buckets: z.array(priceHitDistributionBucketSchema),
  markets: z.array(priceHitMarketItemSchema),
});

export const priceHitExpiryGroupSchema = z.object({
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  events: z.array(priceHitEventDistributionSchema),
});

export const priceHitResponseSchema = z.object({
  asset: priceHitAssetKeySchema,
  assetLabel: z.string(),
  assetName: z.string(),
  fetchedAt: z.string(),
  aiCacheStatus: priceHitAiCacheStatusSchema,
  aiRefreshedAt: z.string().nullable(),
  aiExpiresAt: z.string().nullable(),
  structuredEventCount: z.number().int().min(0),
  defaultExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  defaultEventId: z.string().nullable(),
  expiries: z.array(priceHitExpiryGroupSchema),
});

export const priceHitRefreshAssetResultSchema = z.object({
  asset: priceHitAssetKeySchema,
  assetLabel: z.string(),
  ok: z.boolean(),
  status: z.enum(["refreshed", "stale_fallback", "failed"]),
  structuredEventCount: z.number().int().min(0),
  refreshedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  message: z.string().nullable(),
});

export const priceHitRefreshResponseSchema = z.object({
  fetchedAt: z.string(),
  ok: z.boolean(),
  results: z.array(priceHitRefreshAssetResultSchema),
});
