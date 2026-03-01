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
    outcomePrices: z.union([z.string(), z.array(z.union([z.string(), z.number()]))]).nullable().optional(),
    tags: z.array(gammaTagSchema).nullable().optional(),
    updatedAt: z.string().nullable().optional(),
  })
  .passthrough();

export const gammaEventSchema = z
  .object({
    id: z.union([z.string(), z.number()]).nullable().optional(),
    title: z.string().nullable().optional(),
    slug: z.string().nullable().optional(),
    active: boolLikeSchema,
    closed: boolLikeSchema,
    resolved: boolLikeSchema,
    volume24hr: numberLikeSchema,
    volume: numberLikeSchema,
    tags: z.array(gammaTagSchema).nullable().optional(),
    updatedAt: z.string().nullable().optional(),
  })
  .passthrough();

export const gammaMarketsSchema = z.array(gammaMarketSchema);
export const gammaEventsSchema = z.array(gammaEventSchema);

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
