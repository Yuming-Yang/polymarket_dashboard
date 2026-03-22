import { ClobTrade, SuspicionScoreInput, SuspicionScoreResult, WalletStats } from "@/lib/insider/types";

const HOUR_MS = 60 * 60 * 1_000;
const DAY_HOURS = 24;
const WEEK_HOURS = 24 * 7;
const LARGE_TRADE_FALLBACK_USD = 1_000;

function roundToTenth(value: number) {
  return Math.round(value * 10) / 10;
}

export function isLargeTrade(sizeUsdc: number, marketAverageTradeSize: number | null) {
  if (marketAverageTradeSize !== null && marketAverageTradeSize > 0) {
    return sizeUsdc > marketAverageTradeSize * 2;
  }

  return sizeUsdc >= LARGE_TRADE_FALLBACK_USD;
}

export function buildProjectedWalletStats(
  current: WalletStats | null,
  trade: Pick<ClobTrade, "wallet" | "marketId" | "sizeUsdc" | "timestampMs" | "timestamp">,
  isLarge: boolean,
): WalletStats {
  const existingMarkets = current?.markets ?? [];
  const nextMarkets = existingMarkets.includes(trade.marketId) ? existingMarkets : [...existingMarkets, trade.marketId];
  const firstSeenAt = current?.firstSeenAt ?? trade.timestamp;
  const firstSeenMs = new Date(firstSeenAt).getTime();
  const ageMs = Number.isFinite(firstSeenMs) ? Math.max(0, trade.timestampMs - firstSeenMs) : 0;
  const totalTrades = (current?.totalTrades ?? 0) + 1;
  const totalWins = current?.totalWins ?? 0;
  const resolvedTrades = current?.resolvedTrades ?? 0;

  return {
    wallet: current?.wallet ?? trade.wallet,
    firstSeenAt,
    lastSeenAt: trade.timestamp,
    totalTrades,
    totalWins,
    resolvedTrades,
    totalVolume: roundToTenth((current?.totalVolume ?? 0) + trade.sizeUsdc),
    markets: nextMarkets,
    consecutiveLarge: isLarge ? (current?.consecutiveLarge ?? 0) + 1 : 0,
    updatedAt: trade.timestamp,
    marketCount: nextMarkets.length,
    walletAgeHours: ageMs / HOUR_MS,
    walletWinRate: resolvedTrades > 0 ? totalWins / resolvedTrades : null,
  };
}

export function calcSuspicionScore(input: SuspicionScoreInput): SuspicionScoreResult {
  let score = 0;
  const flags: SuspicionScoreResult["flags"] = [];

  if (input.wallet.walletAgeHours !== null && input.wallet.walletAgeHours < DAY_HOURS) {
    score += 3;
    flags.push("new_wallet");
  } else if (input.wallet.walletAgeHours !== null && input.wallet.walletAgeHours < WEEK_HOURS) {
    score += 1.5;
    flags.push("young_wallet");
  }

  if (input.marketAverageTradeSize !== null && input.marketAverageTradeSize > 0) {
    if (input.trade.sizeUsdc > input.marketAverageTradeSize * 5) {
      score += 2;
      flags.push("large_bet_vs_market");
    } else if (input.trade.sizeUsdc > input.marketAverageTradeSize * 2) {
      score += 1;
      flags.push("above_average_bet");
    }
  }

  if (input.wallet.marketCount <= 1) {
    score += 2;
    flags.push("single_market_focus");
  } else if (input.wallet.marketCount <= 2) {
    score += 1;
    flags.push("narrow_focus");
  }

  if (input.wallet.walletWinRate !== null) {
    if (input.wallet.resolvedTrades >= 5 && input.wallet.walletWinRate > 0.8) {
      score += 2;
      flags.push("high_win_rate");
    } else if (input.wallet.walletWinRate > 0.65) {
      score += 1;
      flags.push("good_win_rate");
    }
  }

  if (input.wallet.consecutiveLarge >= 3) {
    score += 1;
    flags.push("consecutive_large_bets");
  }

  if (input.marketVolume24h !== null) {
    if (input.marketVolume24h < 10_000 && input.trade.sizeUsdc > 1_000) {
      score += 2;
      flags.push("niche_market_large_bet");
    } else if (input.marketVolume24h < 50_000 && input.trade.sizeUsdc > 5_000) {
      score += 1;
      flags.push("thin_market_large_bet");
    }
  }

  return {
    score: Math.min(10, roundToTenth(score)),
    flags,
  };
}
