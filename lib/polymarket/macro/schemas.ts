import { z } from "zod";

import { MACRO_BUCKETS, MACRO_MAX_LIMIT } from "@/lib/polymarket/macro/types";

export const macroBucketSchema = z.enum(MACRO_BUCKETS);

export const macroClobMetaSchema = z.object({
  hasToken: z.boolean(),
  has1dHistory: z.boolean(),
  has1wHistory: z.boolean(),
});

export const macroMonitorItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(["active", "resolved", "closed", "unknown"]),
  url: z.string().nullable(),
  tags: z.array(z.string()),
  updatedAt: z.string().nullable(),
  volume24hUsd: z.number().nullable(),
  expectationProb: z.number().nullable(),
  change1dClob: z.number().nullable(),
  change1wClob: z.number().nullable(),
  bucket: macroBucketSchema,
  clobMeta: macroClobMetaSchema,
});

export const macroGroupSummarySchema = z.object({
  bucket: macroBucketSchema,
  count: z.number().int().nonnegative(),
  totalVolume24hUsd: z.number().nonnegative(),
});

export const macroStatsSchema = z.object({
  marketCount: z.number().int().nonnegative(),
  totalVolume24hUsd: z.number().nonnegative(),
  largestAbsMove1d: z.number().nullable(),
  largestAbsMove1w: z.number().nullable(),
  medianExpectationProb: z.number().nullable(),
  clobCoverageRate1d: z.number().min(0).max(1),
  clobCoverageRate1w: z.number().min(0).max(1),
});

export const macroResponseSchema = z.object({
  params: z.object({
    limit: z.number().int().positive().max(MACRO_MAX_LIMIT),
    includeTagsFixed: z.tuple([z.literal("economy"), z.literal("finance")]),
  }),
  fetchedAt: z.string(),
  items: z.array(macroMonitorItemSchema),
  groups: z.array(macroGroupSummarySchema),
  stats: macroStatsSchema,
});

export const macroSummarySchema = z.object({
  takeaway: z.string(),
  topRecentChanges: z.array(z.string()).max(8),
  groupHighlights: z
    .array(
      z.object({
        group: macroBucketSchema,
        note: z.string(),
      }),
    )
    .max(8),
  watchItems: z
    .array(
      z.object({
        title: z.string(),
        reason: z.string(),
      }),
    )
    .max(10),
});

export const macroSummaryRequestSchema = z.object({
  snapshotAt: z.string(),
  items: z.array(macroMonitorItemSchema).max(MACRO_MAX_LIMIT),
  groups: z.array(macroGroupSummarySchema).max(MACRO_BUCKETS.length),
  stats: macroStatsSchema,
});

export const macroSummaryResponseSchema = z.object({
  generatedAt: z.string(),
  model: z.string(),
  summary: macroSummarySchema,
});
