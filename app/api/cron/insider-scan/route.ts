import { NextRequest, NextResponse } from "next/server";

import {
  classifyResolvedTradeOutcome,
  fetchCandidateMarketsForScan,
  fetchMarketDetail,
  fetchMarketTrades,
  InsiderUpstreamError,
  INSIDER_UPSTREAM_ENDPOINTS,
} from "@/lib/insider/clob";
import { isExcludedWallet } from "@/lib/insider/denylist";
import {
  buildProjectedWalletStats,
  calcSuspicionScore,
  isLargeTrade,
} from "@/lib/insider/scorer";
import {
  fetchLatestTradeLedgerTimestamp,
  fetchPendingTradeSettlements,
  getWalletHistory,
  ingestInsiderTrade,
  saveInsiderAlert,
  settleInsiderTrade,
  updateScanState,
} from "@/lib/insider/supabase";
import {
  ClobTrade,
  MarketDetail,
  TradeNormalizationRejectReason,
} from "@/lib/insider/types";

export const runtime = "nodejs";
export const maxDuration = 55;

const MIN_ALERT_SCORE = 6;
const MAX_MARKET_FETCH_CONCURRENCY = 8;
const MARKET_TRADE_PAGE_LIMIT = 100;
const MARKET_TRADE_MAX_PAGES = 3;
const MARKET_SCAN_LIMIT = 200;

type TradeContext = {
  trade: ClobTrade;
  market: MarketDetail;
  marketAverageTradeSize: number | null;
};

type ScanDiagnostics = {
  upstream: {
    tradesBaseUrl: string;
    gammaBaseUrl: string;
    mode: "market-scoped-data-api";
  };
  candidateMarkets: number;
  marketTradeRequests: number;
  fetchedTrades: number;
  normalizedTrades: number;
  rejectedTrades: number;
  rejectedByReason: Partial<Record<TradeNormalizationRejectReason, number>>;
  duplicateTrades: number;
  excludedWalletTrades: number;
  scannedTrades: number;
  insertedTrades: number;
  alerts: number;
  settledTrades: number;
  settlementSkippedMissingWinner: number;
  marketFetchFailures: number;
  upstreamTimeouts: number;
  upstreamRateLimits: number;
  upstreamHttpErrors: number;
  upstreamNetworkErrors: number;
};

function withNoStoreHeaders(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function createDiagnostics(): ScanDiagnostics {
  return {
    upstream: {
      ...INSIDER_UPSTREAM_ENDPOINTS,
      mode: "market-scoped-data-api",
    },
    candidateMarkets: 0,
    marketTradeRequests: 0,
    fetchedTrades: 0,
    normalizedTrades: 0,
    rejectedTrades: 0,
    rejectedByReason: {},
    duplicateTrades: 0,
    excludedWalletTrades: 0,
    scannedTrades: 0,
    insertedTrades: 0,
    alerts: 0,
    settledTrades: 0,
    settlementSkippedMissingWinner: 0,
    marketFetchFailures: 0,
    upstreamTimeouts: 0,
    upstreamRateLimits: 0,
    upstreamHttpErrors: 0,
    upstreamNetworkErrors: 0,
  };
}

function recordRejectReasons(
  target: Partial<Record<TradeNormalizationRejectReason, number>>,
  source: Partial<Record<TradeNormalizationRejectReason, number>>,
) {
  for (const [reason, count] of Object.entries(source) as Array<
    [TradeNormalizationRejectReason, number]
  >) {
    target[reason] = (target[reason] ?? 0) + count;
  }
}

function recordUpstreamFailure(diagnostics: ScanDiagnostics, error: unknown) {
  if (!(error instanceof InsiderUpstreamError)) {
    return;
  }

  if (error.kind === "timeout") {
    diagnostics.upstreamTimeouts += 1;
    return;
  }

  if (error.kind === "network") {
    diagnostics.upstreamNetworkErrors += 1;
    return;
  }

  if (error.upstreamStatus === 429) {
    diagnostics.upstreamRateLimits += 1;
    return;
  }

  diagnostics.upstreamHttpErrors += 1;
}

function averageTradeSize(trades: ClobTrade[]) {
  if (trades.length === 0) {
    return null;
  }

  const total = trades.reduce((sum, trade) => sum + trade.sizeUsdc, 0);
  return total / trades.length;
}

function dedupeTradeContexts(
  trades: TradeContext[],
  diagnostics: ScanDiagnostics,
) {
  const seenTradeIds = new Set<string>();
  const deduped: TradeContext[] = [];

  for (const tradeContext of trades) {
    if (seenTradeIds.has(tradeContext.trade.tradeId)) {
      diagnostics.duplicateTrades += 1;
      continue;
    }

    seenTradeIds.add(tradeContext.trade.tradeId);
    deduped.push(tradeContext);
  }

  return deduped;
}

function createMarketLoader() {
  const cache = new Map<string, Promise<MarketDetail>>();

  return (conditionId: string) => {
    const existing = cache.get(conditionId);
    if (existing) {
      return existing;
    }

    const pending = fetchMarketDetail(conditionId);
    cache.set(conditionId, pending);
    return pending;
  };
}

async function mapWithConcurrency<T, TResult>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<TResult>,
) {
  if (items.length === 0) {
    return [] as TResult[];
  }

  const results = new Array<TResult>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

async function settlePendingTrades(
  loadMarket: (conditionId: string) => Promise<MarketDetail>,
  diagnostics: ScanDiagnostics,
) {
  const pendingTrades = await fetchPendingTradeSettlements();

  for (const trade of pendingTrades) {
    try {
      const market = await loadMarket(trade.marketId);
      if (!market.resolved && !market.closed) {
        continue;
      }

      const isWin = classifyResolvedTradeOutcome(trade, market);
      if (isWin === null) {
        diagnostics.settlementSkippedMissingWinner += 1;
        console.info("[cron/insider-scan] settlement_skipped_missing_winner", {
          tradeId: trade.tradeId,
          marketId: trade.marketId,
        });
        continue;
      }

      const applied = await settleInsiderTrade(trade.tradeId, isWin);
      if (applied) {
        diagnostics.settledTrades += 1;
      }
    } catch (error) {
      recordUpstreamFailure(diagnostics, error);
      console.error("[cron/insider-scan] failed to settle pending trade", {
        tradeId: trade.tradeId,
        marketId: trade.marketId,
        error,
      });
    }
  }
}

async function fetchTradeContexts(
  afterTimestampMs: number | null,
  diagnostics: ScanDiagnostics,
) {
  const candidateMarkets = await fetchCandidateMarketsForScan({
    limit: MARKET_SCAN_LIMIT,
  });
  diagnostics.candidateMarkets = candidateMarkets.length;

  const marketResults = await mapWithConcurrency(
    candidateMarkets,
    MAX_MARKET_FETCH_CONCURRENCY,
    async (market) => {
      diagnostics.marketTradeRequests += 1;

      try {
        const batch = await fetchMarketTrades({
          marketId: market.conditionId,
          afterTimestampMs,
          limit: MARKET_TRADE_PAGE_LIMIT,
          maxPages: MARKET_TRADE_MAX_PAGES,
        });

        return {
          market,
          batch,
          error: null,
        };
      } catch (error) {
        return {
          market,
          batch: null,
          error,
        };
      }
    },
  );

  const tradeContexts: TradeContext[] = [];

  for (const result of marketResults) {
    if (result.error) {
      diagnostics.marketFetchFailures += 1;
      recordUpstreamFailure(diagnostics, result.error);
      console.error("[cron/insider-scan] failed to fetch market trades", {
        marketId: result.market.conditionId,
        error: result.error,
      });
      continue;
    }

    const batch = result.batch;
    if (!batch) {
      continue;
    }

    diagnostics.fetchedTrades += batch.diagnostics.rawCount;
    diagnostics.normalizedTrades += batch.diagnostics.normalizedCount;
    diagnostics.duplicateTrades += batch.diagnostics.duplicateCount;
    recordRejectReasons(
      diagnostics.rejectedByReason,
      batch.diagnostics.rejectedByReason,
    );

    const marketAverageTradeSize = averageTradeSize(batch.trades);
    for (const trade of batch.trades) {
      tradeContexts.push({
        trade,
        market: result.market,
        marketAverageTradeSize,
      });
    }
  }

  diagnostics.rejectedTrades = Object.values(
    diagnostics.rejectedByReason,
  ).reduce((sum, count) => sum + count, 0);

  const deduped = dedupeTradeContexts(tradeContexts, diagnostics);
  const eligibleTrades = deduped
    .filter((tradeContext) => !isExcludedWallet(tradeContext.trade.wallet))
    .sort((left, right) => left.trade.timestampMs - right.trade.timestampMs);

  diagnostics.excludedWalletTrades = deduped.length - eligibleTrades.length;
  diagnostics.scannedTrades = eligibleTrades.length;

  return eligibleTrades;
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

  const diagnostics = createDiagnostics();

  try {
    const loadMarket = createMarketLoader();
    await settlePendingTrades(loadMarket, diagnostics);

    const latestProcessedTradeAt = await fetchLatestTradeLedgerTimestamp();
    const tradeContexts = await fetchTradeContexts(
      latestProcessedTradeAt ? Date.parse(latestProcessedTradeAt) : null,
      diagnostics,
    );

    let analyzed = 0;
    let alerts = 0;

    for (const tradeContext of tradeContexts) {
      const { trade, market, marketAverageTradeSize } = tradeContext;
      const walletHistory = await getWalletHistory(trade.wallet);
      const marketTitle = market.title ?? trade.marketTitle ?? "Unknown market";
      const marketSlug = market.slug ?? trade.marketSlug;
      const largeTrade = isLargeTrade(trade.sizeUsdc, marketAverageTradeSize);
      const projectedWallet = buildProjectedWalletStats(
        walletHistory,
        trade,
        largeTrade,
      );
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
        diagnostics.duplicateTrades += 1;
        continue;
      }

      analyzed += 1;
      diagnostics.insertedTrades += 1;

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
          diagnostics.alerts += 1;
        }
      }
    }

    const lastScannedAt = new Date().toISOString();
    await updateScanState({
      lastScannedAt,
      scannedCount: diagnostics.scannedTrades,
      analyzedCount: analyzed,
      alertsCount: alerts,
    });

    console.info("[cron/insider-scan] completed", diagnostics);

    return withNoStoreHeaders(
      NextResponse.json({
        scanned: diagnostics.scannedTrades,
        analyzed,
        alerts,
        lastScannedAt,
        diagnostics,
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

    console.error("[cron/insider-scan] unexpected error", {
      error,
      diagnostics,
    });

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
