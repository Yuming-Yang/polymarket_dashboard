import { describe, expect, it } from "vitest";

import {
  buildPriceHitExpiryDistributions,
  extractStrikePrice,
  getDefaultPriceHitExpiry,
  normalizePriceHitMarketsForEvent,
  repairPriceHitSurvivalProbabilities,
  type PriceHitNormalizedMarket,
} from "@/lib/polymarket/price-hit";
import { PriceHitStructuredEvent } from "@/lib/polymarket/types";

const structuredEvent: PriceHitStructuredEvent = {
  asset: "nvda",
  eventId: "event-1",
  eventSlug: "nvda-march-targets",
  eventTitle: "NVDA March Targets",
  expiryDate: "2026-03-31",
};

describe("price hit market parsing", () => {
  it("prefers numeric groupItemThreshold and falls back to text parsing", () => {
    expect(extractStrikePrice({ groupItemThreshold: "120" })).toBe(120);
    expect(extractStrikePrice({ question: "Will Bitcoin reach $150k this quarter?" })).toBe(150_000);
    expect(extractStrikePrice({ title: "Will Oil hit 82.5 by month-end?" })).toBe(82.5);
  });

  it("filters for active liquid binary markets and normalizes strike/probability pairs", () => {
    const rawEvent = {
      id: "event-1",
      markets: [
        {
          id: "m-1",
          question: "Will NVDA reach $120 by March?",
          slug: "nvda-120-march",
          groupItemThreshold: "120",
          active: true,
          closed: false,
          resolved: false,
          outcomes: ["Yes", "No"],
          outcomePrices: "[0.74,0.26]",
          volume24hr: "2000",
          volumeNum: "10000",
          endDate: "2026-03-31T23:59:00Z",
        },
        {
          id: "m-2",
          question: "Illiquid duplicate",
          slug: "nvda-140-march-illiquid",
          groupItemThreshold: "140",
          active: true,
          closed: false,
          resolved: false,
          outcomes: ["Yes", "No"],
          outcomePrices: "[0.44,0.56]",
          volume24hr: "10",
          volumeNum: "200",
          endDate: "2026-03-31T23:59:00Z",
        },
        {
          id: "m-3",
          question: "Resolved",
          groupItemThreshold: "160",
          active: false,
          closed: true,
          resolved: true,
          outcomes: ["Yes", "No"],
          outcomePrices: "[0.10,0.90]",
          volume24hr: "5000",
          volumeNum: "20000",
          endDate: "2026-03-31T23:59:00Z",
        },
      ],
    };

    const markets = normalizePriceHitMarketsForEvent(rawEvent, structuredEvent);

    expect(markets).toHaveLength(1);
    expect(markets[0]).toMatchObject({
      marketId: "m-1",
      strikePrice: 120,
      probability: 0.74,
      expiryDate: "2026-03-31",
    });
  });
});

describe("price hit distributions", () => {
  it("repairs non-monotone survival probabilities", () => {
    expect(repairPriceHitSurvivalProbabilities([0.8, 0.85, 0.4])).toEqual([0.8, 0.8, 0.4]);
  });

  it("merges same-expiry markets, dedupes duplicate strikes by liquidity, and computes quantiles", () => {
    const markets: PriceHitNormalizedMarket[] = [
      {
        marketId: "m-100",
        eventId: "event-a",
        eventTitle: "BTC March",
        title: "Will Bitcoin reach $100k?",
        strikePrice: 100_000,
        probability: 0.8,
        volume24hUsd: 5_000,
        volumeTotalUsd: 20_000,
        url: null,
        updatedAt: "2026-03-22T00:00:00.000Z",
        expiryDate: "2026-03-31",
        liquidityScore: 20_000,
      },
      {
        marketId: "m-120-low",
        eventId: "event-a",
        eventTitle: "BTC March",
        title: "Lower-liquidity duplicate",
        strikePrice: 120_000,
        probability: 0.7,
        volume24hUsd: 1_500,
        volumeTotalUsd: 8_000,
        url: null,
        updatedAt: "2026-03-22T00:00:00.000Z",
        expiryDate: "2026-03-31",
        liquidityScore: 8_000,
      },
      {
        marketId: "m-120-high",
        eventId: "event-b",
        eventTitle: "BTC Alternative March",
        title: "Higher-liquidity duplicate",
        strikePrice: 120_000,
        probability: 0.85,
        volume24hUsd: 4_000,
        volumeTotalUsd: 30_000,
        url: null,
        updatedAt: "2026-03-22T00:00:00.000Z",
        expiryDate: "2026-03-31",
        liquidityScore: 30_000,
      },
      {
        marketId: "m-140",
        eventId: "event-a",
        eventTitle: "BTC March",
        title: "Will Bitcoin reach $140k?",
        strikePrice: 140_000,
        probability: 0.4,
        volume24hUsd: 3_000,
        volumeTotalUsd: 18_000,
        url: null,
        updatedAt: "2026-03-22T00:00:00.000Z",
        expiryDate: "2026-03-31",
        liquidityScore: 18_000,
      },
    ];

    const [distribution] = buildPriceHitExpiryDistributions(markets);

    expect(distribution).toBeDefined();
    expect(distribution?.strikeCount).toBe(3);
    expect(distribution?.markets.map((market) => market.marketId)).toEqual(["m-100", "m-120-high", "m-140"]);
    expect(distribution?.buckets.map((bucket) => Number(bucket.probabilityDensity.toFixed(2)))).toEqual([0.2, 0, 0.4, 0.4]);
    expect(distribution?.impliedMedianPrice).toBe(135_000);
    expect(distribution?.range90Low).toBe(85_000);
    expect(distribution?.range90High).toBe(157_500);
  });

  it("selects the nearest upcoming expiry by default", () => {
    const defaultExpiry = getDefaultPriceHitExpiry(
      [{ expiryDate: "2026-03-01" }, { expiryDate: "2026-04-15" }, { expiryDate: "2026-05-01" }],
      new Date("2026-03-22T00:00:00.000Z"),
    );

    expect(defaultExpiry).toBe("2026-04-15");
  });
});
