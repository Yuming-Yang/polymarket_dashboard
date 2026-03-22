import { NextRequest, NextResponse } from "next/server";

import {
  classifyResolvedTradeOutcome,
  fetchMarketAverageTradeSize,
  fetchMarketDetail,
  fetchTradesForScan,
  InsiderUpstreamError,
} from "@/lib/insider/clob";
import { isExcludedWallet } from "@/lib/insider/denylist";
import { buildProjectedWalletStats, calcSuspicionScore, isLargeTrade } from "@/lib/insider/scorer";
import {
  fetchLatestTradeLedgerTimestamp,
  fetchPendingTradeSettlements,
  getWalletHistory,
  ingestInsiderTrade,
  saveInsiderAlert,
  settleInsiderTrade,
  updateScanState,
} from "@/lib/insider/supabase";
import { MarketDetail } from "@/lib/insider/types";

export const runtime = "nodejs";
export const maxDuration = 55;

const MIN_ALERT_SCORE = 6;
const GLOBAL_TRADE_PAGE_LIMIT = 100;
const GLOBAL_TRADE_MAX_PAGES = 20;

function withNoStoreHeaders(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function createMarketLoader() {
  const cache = new Map<string, Promise<MarketDetail>>();

  return (marketId: string) => {
    const existing = cache.get(marketId);
    if (existing) {
      return existing;
    }

    const pending = fetchMarketDetail(marketId);
    cache.set(marketId, pending);
    return pending;
  };
}

function createMarketAverageLoader() {
  const cache = new Map<string, Promise<number | null>>();

  return (marketId: string) => {
    const existing = cache.get(marketId);
    if (existing) {
      return existing;
    }

    const pending = fetchMarketAverageTradeSize(marketId);
    cache.set(marketId, pending);
    return pending;
  };
}

async function settlePendingTrades(loadMarket: (marketId: string) => Promise<MarketDetail>) {
  let settled = 0;
  const pendingTrades = await fetchPendingTradeSettlements();

  for (const trade of pendingTrades) {
    try {
      const market = await loadMarket(trade.marketId);
      if (!market.resolved && !market.closed) {
        continue;
      }

      const isWin = classifyResolvedTradeOutcome(trade, market);
      if (isWin === null) {
        continue;
      }

      const applied = await settleInsiderTrade(trade.tradeId, isWin);
      if (applied) {
        settled += 1;
      }
    } catch (error) {
      console.error("[cron/insider-scan] failed to settle pending trade", {
        tradeId: trade.tradeId,
        marketId: trade.marketId,
        error,
      });
    }
  }

  return settled;
}

export async function GET(request: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    return withNoStoreHeaders(
      NextResponse.json(
        {
          error: {
            message: "CRON_SECRET is not configured.",
          },
        },
        { status: 500 },
      ),
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${expectedSecret}`) {
    return withNoStoreHeaders(
      NextResponse.json(
        {
          error: {
            message: "Unauthorized",
          },
        },
        { status: 401 },
      ),
    );
  }

  try {
    const loadMarket = createMarketLoader();
    const loadMarketAverage = createMarketAverageLoader();
    await settlePendingTrades(loadMarket);
    const latestProcessedTradeAt = await fetchLatestTradeLedgerTimestamp();

    const recentTrades = await fetchTradesForScan({
      afterTimestampMs: latestProcessedTradeAt ? Date.parse(latestProcessedTradeAt) : null,
      limit: GLOBAL_TRADE_PAGE_LIMIT,
      maxPages: GLOBAL_TRADE_MAX_PAGES,
    });

    const eligibleTrades = recentTrades.filter((trade) => !isExcludedWallet(trade.wallet)).sort((left, right) => left.timestampMs - right.timestampMs);

    let analyzed = 0;
    let alerts = 0;

    for (const trade of eligibleTrades) {
      const [walletHistory, market, marketAverageTradeSize] = await Promise.all([
        getWalletHistory(trade.wallet),
        loadMarket(trade.marketId),
        loadMarketAverage(trade.marketId),
      ]);
      const marketTitle = market.title ?? trade.marketTitle ?? "Unknown market";
      const marketSlug = market.slug ?? trade.marketSlug;
      const largeTrade = isLargeTrade(trade.sizeUsdc, marketAverageTradeSize);
      const projectedWallet = buildProjectedWalletStats(walletHistory, trade, largeTrade);
      const scoredTrade = calcSuspicionScore({
        trade,
        wallet: projectedWallet,
        marketAverageTradeSize,
        marketVolume24h: market.volume24h,
      });

      const inserted = await ingestInsiderTrade({
        trade,
        marketSlug,
        marketTitle,
        isLarge: largeTrade,
      });

      if (!inserted) {
        continue;
      }

      analyzed += 1;

      if (scoredTrade.score >= MIN_ALERT_SCORE) {
        const saved = await saveInsiderAlert({
          tradeId: trade.tradeId,
          marketId: trade.marketId,
          marketSlug,
          marketTitle,
          wallet: trade.wallet,
          sizeUsdc: trade.sizeUsdc,
          price: trade.price,
          side: trade.side,
          score: scoredTrade.score,
          flags: scoredTrade.flags,
          walletAgeHours: projectedWallet.walletAgeHours,
          walletWinRate: projectedWallet.walletWinRate,
          walletTotalTrades: projectedWallet.totalTrades,
        });

        if (saved) {
          alerts += 1;
        }
      }
    }

    const lastScannedAt = new Date().toISOString();
    await updateScanState({
      lastScannedAt,
      scannedCount: eligibleTrades.length,
      analyzedCount: analyzed,
      alertsCount: alerts,
    });

    return withNoStoreHeaders(
      NextResponse.json({
        scanned: eligibleTrades.length,
        analyzed,
        alerts,
        lastScannedAt,
      }),
    );
  } catch (error) {
    if (error instanceof InsiderUpstreamError && error.upstreamStatus === 429) {
      return withNoStoreHeaders(
        NextResponse.json(
          {
            error: {
              message: "Upstream rate limit reached. Please retry shortly.",
              upstreamStatus: error.upstreamStatus,
            },
          },
          { status: 429 },
        ),
      );
    }

    console.error("[cron/insider-scan] unexpected error", error);

    return withNoStoreHeaders(
      NextResponse.json(
        {
          error: {
            message: "Failed to run insider scan.",
          },
        },
        { status: 502 },
      ),
    );
  }
}
