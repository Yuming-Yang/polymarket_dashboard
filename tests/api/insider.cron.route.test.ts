import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/cron/insider-scan/route";
import { fetchMarketAverageTradeSize, fetchMarketDetail, fetchTradesForScan } from "@/lib/insider/clob";
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

vi.mock("@/lib/insider/clob", () => ({
  fetchTradesForScan: vi.fn(),
  fetchMarketAverageTradeSize: vi.fn(),
  fetchMarketDetail: vi.fn(),
  classifyResolvedTradeOutcome: vi.fn(() => true),
  InsiderUpstreamError: class InsiderUpstreamError extends Error {
    upstreamStatus = 429;
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
    markets: ["market-1"],
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
    vi.mocked(fetchTradesForScan).mockReset();
    vi.mocked(fetchMarketAverageTradeSize).mockReset();
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

  it("scans trades, skips duplicates, and updates scan state", async () => {
    vi.mocked(fetchLatestTradeLedgerTimestamp).mockResolvedValue("2026-03-22T09:55:00.000Z");
    vi.mocked(fetchPendingTradeSettlements).mockResolvedValue([
      {
        tradeId: "settle-1",
        marketId: "settled-market",
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

    vi.mocked(fetchTradesForScan).mockResolvedValue([
      {
        tradeId: "trade-1",
        marketId: "market-1",
        marketSlug: null,
        marketTitle: null,
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
        marketId: "market-1",
        marketSlug: null,
        marketTitle: null,
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
    ]);
    vi.mocked(fetchMarketAverageTradeSize).mockResolvedValue(500);

    vi.mocked(fetchMarketDetail).mockImplementation(async (marketId: string) => {
      if (marketId === "settled-market") {
        return {
          id: "settled-market",
          slug: "settled-market",
          title: "Settled market",
          volume24h: 2_000,
          resolved: true,
          closed: true,
          tokens: [{ tokenId: "winner-token", outcome: "YES", winner: true }],
        };
      }

      return {
        id: "market-1",
        slug: "market-1",
        title: "Market 1",
        volume24h: 8_000,
        resolved: false,
        closed: false,
        tokens: [{ tokenId: "token-1", outcome: "YES", winner: false }],
      };
    });

    vi.mocked(getWalletHistory).mockResolvedValue(null);
    vi.mocked(ingestInsiderTrade).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
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
    expect(fetchTradesForScan).toHaveBeenCalledWith(
      expect.objectContaining({
        afterTimestampMs: Date.parse("2026-03-22T09:55:00.000Z"),
      }),
    );
    expect(settleInsiderTrade).toHaveBeenCalledWith("settle-1", true);
    expect(updateScanState).toHaveBeenCalledWith(
      expect.objectContaining({
        scannedCount: 2,
        analyzedCount: 1,
        alertsCount: 1,
      }),
    );
  });
});
