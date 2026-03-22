import { z } from "zod";

const insiderFlagSchema = z.enum([
  "new_wallet",
  "young_wallet",
  "large_bet_vs_market",
  "above_average_bet",
  "single_market_focus",
  "narrow_focus",
  "high_win_rate",
  "good_win_rate",
  "consecutive_large_bets",
  "niche_market_large_bet",
  "thin_market_large_bet",
]);

export const walletStatsSchema = z.object({
  wallet: z.string(),
  firstSeenAt: z.string().nullable(),
  lastSeenAt: z.string().nullable(),
  totalTrades: z.number().int().nonnegative(),
  totalWins: z.number().int().nonnegative(),
  resolvedTrades: z.number().int().nonnegative(),
  totalVolume: z.number().nonnegative(),
  markets: z.array(z.string()),
  consecutiveLarge: z.number().int().nonnegative(),
  updatedAt: z.string().nullable(),
  marketCount: z.number().int().nonnegative(),
  walletAgeHours: z.number().nullable(),
  walletWinRate: z.number().nullable(),
});

export const insiderAlertSchema = z.object({
  id: z.number().int().nonnegative(),
  detectedAt: z.string(),
  tradeId: z.string(),
  marketId: z.string(),
  marketSlug: z.string().nullable(),
  marketTitle: z.string(),
  wallet: z.string(),
  sizeUsdc: z.number().nonnegative(),
  price: z.number().nonnegative(),
  side: z.enum(["BUY", "SELL"]),
  score: z.number().nonnegative(),
  flags: z.array(insiderFlagSchema),
  walletAgeHours: z.number().nullable(),
  walletWinRate: z.number().nullable(),
  walletTotalTrades: z.number().int().nonnegative(),
});

export const insiderAlertsResponseSchema = z.object({
  params: z.object({
    minScore: z.number().min(0).max(10),
    limit: z.number().int().positive(),
    marketId: z.string().nullable(),
  }),
  fetchedAt: z.string(),
  lastScannedAt: z.string().nullable(),
  summary: z.object({
    totalAlerts: z.number().int().nonnegative(),
    highScoreAlerts: z.number().int().nonnegative(),
    newWalletAlerts: z.number().int().nonnegative(),
  }),
  items: z.array(insiderAlertSchema),
});

export const walletAlertsResponseSchema = z.object({
  fetchedAt: z.string(),
  lastScannedAt: z.string().nullable(),
  wallet: z.string(),
  stats: walletStatsSchema.nullable(),
  alerts: z.array(insiderAlertSchema),
});
