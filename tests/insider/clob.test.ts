import { describe, expect, it } from "vitest";

import { classifyResolvedTradeOutcome, normalizeClobTrade, normalizeMakerAmountToUsdc, normalizeShareSize } from "@/lib/insider/clob";

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

describe("normalizeClobTrade", () => {
  it("normalizes a matched trade and lowercases the wallet", () => {
    const trade = normalizeClobTrade({
      id: "trade-1",
      market: "market-1",
      maker: "0xABCD",
      side: "buy",
      price: "0.42",
      makerAmount: "750000000",
      size: "1785.7142857",
      timestamp: "2026-03-22T10:00:00.000Z",
      asset_id: "token-1",
      outcome: "YES",
    });

    expect(trade).toMatchObject({
      tradeId: "trade-1",
      marketId: "market-1",
      wallet: "0xabcd",
      side: "BUY",
      price: 0.42,
      sizeUsdc: 750,
      tokenId: "token-1",
      outcome: "YES",
    });
  });

  it("falls back to size times price and drops trades below the minimum threshold", () => {
    const validTrade = normalizeClobTrade({
      id: "trade-2",
      market: "market-2",
      maker: "0x1234",
      side: "SELL",
      price: "0.25",
      size: "4000",
      timestamp: 1_711_102_400,
    });

    const ignoredTrade = normalizeClobTrade({
      id: "trade-3",
      market: "market-2",
      maker: "0x1234",
      side: "SELL",
      price: "0.25",
      size: "100",
      timestamp: 1_711_102_400,
    });

    expect(validTrade?.sizeUsdc).toBe(1_000);
    expect(validTrade?.side).toBe("SELL");
    expect(ignoredTrade).toBeNull();
  });

  it("allows sub-$500 trades when a lower normalization threshold is requested", () => {
    const trade = normalizeClobTrade(
      {
        id: "trade-4",
        market: "market-2",
        maker: "0x1234",
        side: "SELL",
        price: "0.25",
        size: "100",
        timestamp: 1_711_102_400,
      },
      { minimumSizeUsdc: 0 },
    );

    expect(trade?.sizeUsdc).toBe(25);
  });

  it("supports the official public trades payload shape from the data api", () => {
    const trade = normalizeClobTrade({
      transactionHash: "0xhash",
      proxyWallet: "0xBEEF",
      conditionId: "market-3",
      asset: "token-3",
      side: "BUY",
      price: "0.61",
      size: "1000000000",
      timestamp: "2026-03-22T11:00:00.000Z",
      title: "Will it rain?",
      eventSlug: "will-it-rain",
      outcome: "YES",
    });

    expect(trade).toMatchObject({
      tradeId: expect.stringContaining("0xhash"),
      marketId: "market-3",
      marketSlug: "will-it-rain",
      marketTitle: "Will it rain?",
      wallet: "0xbeef",
      tokenId: "token-3",
      side: "BUY",
      sizeUsdc: 610,
    });
  });
});

describe("classifyResolvedTradeOutcome", () => {
  it("treats BUY as pro-token and SELL as anti-token when the market resolves", () => {
    const market = {
      id: "market-1",
      slug: "market-1",
      title: "Market 1",
      volume24h: 10_000,
      resolved: true,
      closed: true,
      tokens: [
        { tokenId: "token-yes", outcome: "YES", winner: true },
        { tokenId: "token-no", outcome: "NO", winner: false },
      ],
    };

    expect(
      classifyResolvedTradeOutcome(
        {
          tokenId: "token-yes",
          outcome: "YES",
          side: "BUY",
        },
        market,
      ),
    ).toBe(true);

    expect(
      classifyResolvedTradeOutcome(
        {
          tokenId: "token-yes",
          outcome: "YES",
          side: "SELL",
        },
        market,
      ),
    ).toBe(false);
  });
});
