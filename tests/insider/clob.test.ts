import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  classifyResolvedTradeOutcome,
  fetchCandidateMarketsForScan,
  fetchMarketDetail,
  fetchMarketTrades,
  fetchRecentTrades,
  normalizeClobTrade,
  normalizeMakerAmountToUsdc,
  normalizeShareSize,
} from "@/lib/insider/clob";
import {
  activeGammaMarketFixture,
  resolvedGammaMarketFixture,
  unresolvedWinnerGammaMarketFixture,
} from "@/tests/fixtures/insider/gamma-markets";
import {
  marketScopedTradeFixture,
  officialDataApiTradeFixture,
} from "@/tests/fixtures/insider/public-trades";

const fetchMock = vi.fn<typeof fetch>();

describe("normalizeMakerAmountToUsdc", () => {
  it("converts raw 6-decimal maker amounts into USDC", () => {
    expect(normalizeMakerAmountToUsdc("250000000")).toBe(250);
    expect(normalizeMakerAmountToUsdc(1_500_000_000)).toBe(1_500);
  });
});

describe("normalizeShareSize", () => {
  it("converts raw 6-decimal token sizes into human units", () => {
    expect(normalizeShareSize("100000000")).toBe(100);
    expect(normalizeShareSize(4_000)).toBe(4_000);
  });
});

describe("public trade normalization", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("normalizes the documented data api trade shape", () => {
    const trade = normalizeClobTrade(officialDataApiTradeFixture);

    expect(trade).toMatchObject({
      tradeId: expect.stringContaining("0xtradehash1"),
      marketId: "condition-1",
      marketSlug: "will-it-rain",
      marketTitle: "Will it rain?",
      wallet: "0xbeef",
      tokenId: "token-yes",
      outcome: "YES",
      side: "BUY",
      sizeUsdc: 610,
    });
  });

  it("drops trades below the minimum threshold", () => {
    const trade = normalizeClobTrade(
      {
        ...officialDataApiTradeFixture,
        transactionHash: "0xtiny",
        size: "10000000",
      },
      { minimumSizeUsdc: 500 },
    );

    expect(trade).toBeNull();
  });

  it("records duplicate and reject diagnostics when fetching public trades", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify([
          officialDataApiTradeFixture,
          {
            ...officialDataApiTradeFixture,
            transactionHash: "0xmissingwallet",
            proxyWallet: null,
          },
          {
            ...officialDataApiTradeFixture,
          },
        ]),
        { status: 200 },
      ),
    );

    const batch = await fetchRecentTrades({
      limit: 3,
    });

    expect(batch.trades).toHaveLength(1);
    expect(batch.diagnostics.rawCount).toBe(3);
    expect(batch.diagnostics.normalizedCount).toBe(2);
    expect(batch.diagnostics.duplicateCount).toBe(1);
    expect(batch.diagnostics.rejectedByReason.missing_wallet).toBe(1);
  });

  it("filters market-scoped trades using the cutoff overlap window", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            officialDataApiTradeFixture,
            marketScopedTradeFixture,
          ]),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));

    const batch = await fetchMarketTrades({
      marketId: "condition-1",
      afterTimestampMs: Date.parse("2026-03-22T11:00:00.000Z"),
      limit: 2,
      maxPages: 2,
    });

    expect(batch.trades).toHaveLength(1);
    expect(batch.trades[0].tradeId).toContain("0xtradehash1");
    expect(batch.diagnostics.rawCount).toBe(2);
    expect(batch.diagnostics.normalizedCount).toBe(2);
  });
});

describe("gamma market lookups", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("discovers active candidate markets and stops at zero-volume pages", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify([
          activeGammaMarketFixture,
          {
            ...activeGammaMarketFixture,
            id: "gamma-market-zero",
            conditionId: "condition-zero",
            volume24hr: "0",
          },
        ]),
        { status: 200 },
      ),
    );

    const markets = await fetchCandidateMarketsForScan({
      limit: 5,
    });

    expect(markets).toHaveLength(1);
    expect(markets[0]).toMatchObject({
      conditionId: "condition-1",
      gammaMarketId: "gamma-market-1",
      active: true,
    });

    const url = new URL(fetchMock.mock.calls[0][0].toString());
    expect(url.pathname).toBe("/markets");
    expect(url.searchParams.get("active")).toBe("true");
    expect(url.searchParams.get("closed")).toBe("false");
    expect(url.searchParams.get("order")).toBe("volume24hr");
  });

  it("loads market details through the condition_ids query instead of /markets/{id}", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([resolvedGammaMarketFixture]), {
        status: 200,
      }),
    );

    const market = await fetchMarketDetail("condition-2");

    expect(market).toMatchObject({
      id: "condition-2",
      conditionId: "condition-2",
      gammaMarketId: "gamma-market-2",
      resolved: true,
      closed: true,
    });
    expect(market.tokens[0]).toMatchObject({
      tokenId: "winner-token",
      outcome: "YES",
      winner: true,
    });

    const url = new URL(fetchMock.mock.calls[0][0].toString());
    expect(url.pathname).toBe("/markets");
    expect(url.searchParams.get("condition_ids")).toBe("condition-2");
  });
});

describe("classifyResolvedTradeOutcome", () => {
  it("treats BUY as pro-token and SELL as anti-token when the market resolves", () => {
    const market = {
      id: "condition-2",
      conditionId: "condition-2",
      gammaMarketId: "gamma-market-2",
      slug: "resolved-market",
      title: "Resolved market",
      volume24h: 0,
      active: false,
      resolved: true,
      closed: true,
      tokens: [
        { tokenId: "winner-token", outcome: "YES", winner: true },
        { tokenId: "loser-token", outcome: "NO", winner: false },
      ],
    };

    expect(
      classifyResolvedTradeOutcome(
        {
          tokenId: "winner-token",
          outcome: "YES",
          side: "BUY",
        },
        market,
      ),
    ).toBe(true);

    expect(
      classifyResolvedTradeOutcome(
        {
          tokenId: "winner-token",
          outcome: "YES",
          side: "SELL",
        },
        market,
      ),
    ).toBe(false);
  });

  it("returns null when winner metadata is missing", async () => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([unresolvedWinnerGammaMarketFixture]), {
        status: 200,
      }),
    );

    const market = await fetchMarketDetail("condition-3");
    const outcome = classifyResolvedTradeOutcome(
      {
        tokenId: "token-a",
        outcome: "YES",
        side: "BUY",
      },
      market,
    );

    expect(outcome).toBeNull();
  });
});
