import { describe, expect, it } from "vitest";

import { buildProjectedWalletStats, calcSuspicionScore } from "@/lib/insider/scorer";
import { WalletStats } from "@/lib/insider/types";

const baseWallet: WalletStats = {
  wallet: "0xabc",
  firstSeenAt: "2026-03-20T00:00:00.000Z",
  lastSeenAt: "2026-03-21T00:00:00.000Z",
  totalTrades: 4,
  totalWins: 3,
  resolvedTrades: 4,
  totalVolume: 4_000,
  markets: ["market-a"],
  consecutiveLarge: 2,
  updatedAt: "2026-03-21T00:00:00.000Z",
  marketCount: 1,
  walletAgeHours: 48,
  walletWinRate: 0.75,
};

describe("buildProjectedWalletStats", () => {
  it("adds a first market and starts large-bet streaks", () => {
    const projected = buildProjectedWalletStats(
      null,
      {
        wallet: "0xnew",
        marketId: "market-a",
        sizeUsdc: 900,
        timestamp: "2026-03-22T00:00:00.000Z",
        timestampMs: Date.parse("2026-03-22T00:00:00.000Z"),
      },
      true,
    );

    expect(projected.marketCount).toBe(1);
    expect(projected.consecutiveLarge).toBe(1);
    expect(projected.totalTrades).toBe(1);
  });

  it("tracks second-market expansion and third consecutive large bet", () => {
    const projected = buildProjectedWalletStats(
      baseWallet,
      {
        wallet: "0xabc",
        marketId: "market-b",
        sizeUsdc: 1_500,
        timestamp: "2026-03-22T12:00:00.000Z",
        timestampMs: Date.parse("2026-03-22T12:00:00.000Z"),
      },
      true,
    );

    expect(projected.marketCount).toBe(2);
    expect(projected.markets).toEqual(["market-a", "market-b"]);
    expect(projected.consecutiveLarge).toBe(3);
    expect(projected.totalTrades).toBe(5);
  });
});

describe("calcSuspicionScore", () => {
  it("caps the score at 10 while preserving the triggering flags", () => {
    const result = calcSuspicionScore({
      trade: {
        sizeUsdc: 7_000,
      },
      wallet: {
        walletAgeHours: 4,
        walletWinRate: 0.9,
        marketCount: 1,
        totalTrades: 6,
        resolvedTrades: 6,
        consecutiveLarge: 3,
      },
      marketAverageTradeSize: 500,
      marketVolume24h: 5_000,
    });

    expect(result.score).toBe(10);
    expect(result.flags).toEqual([
      "new_wallet",
      "large_bet_vs_market",
      "single_market_focus",
      "high_win_rate",
      "consecutive_large_bets",
      "niche_market_large_bet",
    ]);
  });

  it("uses the lighter signals for young wallets, narrow focus, and good win rate", () => {
    const result = calcSuspicionScore({
      trade: {
        sizeUsdc: 1_600,
      },
      wallet: {
        walletAgeHours: 60,
        walletWinRate: 0.7,
        marketCount: 2,
        totalTrades: 4,
        resolvedTrades: 4,
        consecutiveLarge: 1,
      },
      marketAverageTradeSize: 700,
      marketVolume24h: 75_000,
    });

    expect(result.score).toBe(4.5);
    expect(result.flags).toEqual(["young_wallet", "above_average_bet", "narrow_focus", "good_win_rate"]);
  });

  it("requires five resolved trades before applying the high-win-rate bonus", () => {
    const result = calcSuspicionScore({
      trade: {
        sizeUsdc: 1_200,
      },
      wallet: {
        walletAgeHours: 200,
        walletWinRate: 0.95,
        marketCount: 3,
        totalTrades: 10,
        resolvedTrades: 4,
        consecutiveLarge: 0,
      },
      marketAverageTradeSize: 800,
      marketVolume24h: 120_000,
    });

    expect(result.flags).toEqual(["good_win_rate"]);
    expect(result.score).toBe(1);
  });
});
