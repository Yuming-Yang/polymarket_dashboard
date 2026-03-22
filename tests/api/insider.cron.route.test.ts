import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/cron/insider-scan/route";
import {
  fetchCandidateMarketsForScan,
  fetchMarketDetail,
  fetchMarketTrades,
  InsiderUpstreamError,
} from "@/lib/insider/clob";
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

vi.mock("@/lib/insider/clob", () => ({
  fetchCandidateMarketsForScan: vi.fn(),
  fetchMarketTrades: vi.fn(),
  fetchMarketDetail: vi.fn(),
  classifyResolvedTradeOutcome: vi.fn(() => true),
  INSIDER_UPSTREAM_ENDPOINTS: {
    tradesBaseUrl: "https://data-api.polymarket.com",
    gammaBaseUrl: "https://gamma-api.polymarket.com",
  },
  InsiderUpstreamError: class InsiderUpstreamError extends Error {
    upstreamStatus: number;
    kind: "http" | "timeout" | "network";
    source: "data-api" | "gamma";
    url: string;

    constructor(
      message: string,
      options: {
        upstreamStatus?: number;
        kind: "http" | "timeout" | "network";
        source: "data-api" | "gamma";
        url: string;
      },
    ) {
      super(message);
      this.name = "InsiderUpstreamError";
      this.upstreamStatus = options.upstreamStatus ?? 0;
      this.kind = options.kind;
      this.source = options.source;
      this.url = options.url;
    }
  },
}));

vi.mock("@/lib/insider/scorer", () => ({
  buildProjectedWalletStats: vi.fn(() => ({
    wallet: "0xabc",
    firstSeenAt: "2026-03-22T09:00:00.000Z",
    lastSeenAt: "2026-03-22T10:00:00.000Z",
    totalTrades: 1,
    totalWins: 0,
    resolvedTrades: 0,
    totalVolume: 600,
    markets: ["condition-1"],
    consecutiveLarge: 1,
    updatedAt: "2026-03-22T10:00:00.000Z",
    marketCount: 1,
    walletAgeHours: 1,
    walletWinRate: 0,
  })),
  calcSuspicionScore: vi.fn(() => ({
    score: 6.5,
    flags: ["new_wallet"],
  })),
  isLargeTrade: vi.fn(() => true),
}));

vi.mock("@/lib/insider/supabase", () => ({
  fetchLatestTradeLedgerTimestamp: vi.fn(),
  fetchPendingTradeSettlements: vi.fn(),
  getWalletHistory: vi.fn(),
  ingestInsiderTrade: vi.fn(),
  saveInsiderAlert: vi.fn(),
  settleInsiderTrade: vi.fn(),
  updateScanState: vi.fn(),
}));

describe("GET /api/cron/insider-scan", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "test-secret";

    vi.mocked(fetchPendingTradeSettlements).mockReset();
    vi.mocked(fetchLatestTradeLedgerTimestamp).mockReset();
    vi.mocked(fetchCandidateMarketsForScan).mockReset();
    vi.mocked(fetchMarketTrades).mockReset();
    vi.mocked(fetchMarketDetail).mockReset();
    vi.mocked(getWalletHistory).mockReset();
    vi.mocked(buildProjectedWalletStats).mockClear();
    vi.mocked(calcSuspicionScore).mockClear();
    vi.mocked(isLargeTrade).mockClear();
    vi.mocked(ingestInsiderTrade).mockReset();
    vi.mocked(saveInsiderAlert).mockReset();
    vi.mocked(settleInsiderTrade).mockReset();
    vi.mocked(updateScanState).mockReset();
  });

  it("rejects invalid cron secrets", async () => {
    const request = new NextRequest("http://localhost/api/cron/insider-scan");
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("scans market-scoped trades, skips ledger duplicates, and returns diagnostics", async () => {
    vi.mocked(fetchLatestTradeLedgerTimestamp).mockResolvedValue(
      "2026-03-22T09:55:00.000Z",
    );
    vi.mocked(fetchPendingTradeSettlements).mockResolvedValue([
      {
        tradeId: "settle-1",
        marketId: "condition-settled",
        marketSlug: "settled-market",
        marketTitle: "Settled market",
        wallet: "0xolder",
        tokenId: "winner-token",
        outcome: "YES",
        side: "BUY",
        sizeUsdc: 600,
        price: 0.6,
        tradedAt: "2026-03-20T10:00:00.000Z",
        isLarge: true,
        isWin: null,
        winApplied: false,
        raw: {},
      },
    ]);
    vi.mocked(fetchCandidateMarketsForScan).mockResolvedValue([
      {
        id: "condition-1",
        conditionId: "condition-1",
        gammaMarketId: "gamma-market-1",
        slug: "market-1",
        title: "Market 1",
        volume24h: 8_000,
        active: true,
        resolved: false,
        closed: false,
        tokens: [{ tokenId: "token-1", outcome: "YES", winner: false }],
      },
    ]);
    vi.mocked(fetchMarketTrades).mockResolvedValue({
      trades: [
        {
          tradeId: "trade-1",
          marketId: "condition-1",
          marketSlug: "market-1",
          marketTitle: "Market 1",
          wallet: "0xabc",
          tokenId: "token-1",
          outcome: "YES",
          side: "BUY",
          price: 0.42,
          sizeUsdc: 750,
          shareSize: 1785.7,
          timestamp: "2026-03-22T10:00:00.000Z",
          timestampMs: Date.parse("2026-03-22T10:00:00.000Z"),
          raw: {},
        },
        {
          tradeId: "trade-2",
          marketId: "condition-1",
          marketSlug: "market-1",
          marketTitle: "Market 1",
          wallet: "0xabc",
          tokenId: "token-1",
          outcome: "YES",
          side: "BUY",
          price: 0.44,
          sizeUsdc: 850,
          shareSize: 1931.8,
          timestamp: "2026-03-22T10:05:00.000Z",
          timestampMs: Date.parse("2026-03-22T10:05:00.000Z"),
          raw: {},
        },
      ],
      diagnostics: {
        rawCount: 2,
        normalizedCount: 2,
        duplicateCount: 0,
        rejectedByReason: {},
      },
    });
    vi.mocked(fetchMarketDetail).mockResolvedValue({
      id: "condition-settled",
      conditionId: "condition-settled",
      gammaMarketId: "gamma-settled",
      slug: "settled-market",
      title: "Settled market",
      volume24h: 2_000,
      active: false,
      resolved: true,
      closed: true,
      tokens: [{ tokenId: "winner-token", outcome: "YES", winner: true }],
    });

    vi.mocked(getWalletHistory).mockResolvedValue(null);
    vi.mocked(ingestInsiderTrade)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    vi.mocked(saveInsiderAlert).mockResolvedValue(true);
    vi.mocked(settleInsiderTrade).mockResolvedValue(true);

    const request = new NextRequest("http://localhost/api/cron/insider-scan", {
      headers: {
        authorization: "Bearer test-secret",
      },
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(json.scanned).toBe(2);
    expect(json.analyzed).toBe(1);
    expect(json.alerts).toBe(1);
    expect(json.diagnostics).toMatchObject({
      candidateMarkets: 1,
      fetchedTrades: 2,
      normalizedTrades: 2,
      insertedTrades: 1,
      alerts: 1,
      settledTrades: 1,
      duplicateTrades: 1,
    });
    expect(fetchMarketTrades).toHaveBeenCalledWith(
      expect.objectContaining({
        marketId: "condition-1",
        afterTimestampMs: Date.parse("2026-03-22T09:55:00.000Z"),
      }),
    );
    expect(updateScanState).toHaveBeenCalledWith(
      expect.objectContaining({
        scannedCount: 2,
        analyzedCount: 1,
        alertsCount: 1,
      }),
    );
  });

  it("continues when a market trade request times out and surfaces diagnostics", async () => {
    vi.mocked(fetchLatestTradeLedgerTimestamp).mockResolvedValue(null);
    vi.mocked(fetchPendingTradeSettlements).mockResolvedValue([]);
    vi.mocked(fetchCandidateMarketsForScan).mockResolvedValue([
      {
        id: "condition-timeout",
        conditionId: "condition-timeout",
        gammaMarketId: "gamma-timeout",
        slug: "timeout-market",
        title: "Timeout market",
        volume24h: 5_000,
        active: true,
        resolved: false,
        closed: false,
        tokens: [],
      },
    ]);
    vi.mocked(fetchMarketTrades).mockRejectedValue(
      new InsiderUpstreamError("Upstream request timed out", {
        kind: "timeout",
        source: "data-api",
        url: "https://data-api.polymarket.com/trades",
      }),
    );
    vi.mocked(ingestInsiderTrade).mockResolvedValue(false);

    const request = new NextRequest("http://localhost/api/cron/insider-scan", {
      headers: {
        authorization: "Bearer test-secret",
      },
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.scanned).toBe(0);
    expect(json.diagnostics.marketFetchFailures).toBe(1);
    expect(json.diagnostics.upstreamTimeouts).toBe(1);
    expect(updateScanState).toHaveBeenCalledWith(
      expect.objectContaining({
        scannedCount: 0,
        analyzedCount: 0,
        alertsCount: 0,
      }),
    );
  });

  it("returns 429 when candidate market discovery is rate limited", async () => {
    vi.mocked(fetchPendingTradeSettlements).mockResolvedValue([]);
    vi.mocked(fetchLatestTradeLedgerTimestamp).mockResolvedValue(null);
    vi.mocked(fetchCandidateMarketsForScan).mockRejectedValue(
      new InsiderUpstreamError("Rate limited", {
        upstreamStatus: 429,
        kind: "http",
        source: "gamma",
        url: "https://gamma-api.polymarket.com/markets",
      }),
    );

    const request = new NextRequest("http://localhost/api/cron/insider-scan", {
      headers: {
        authorization: "Bearer test-secret",
      },
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(429);
    expect(json.error.upstreamStatus).toBe(429);
  });
});
