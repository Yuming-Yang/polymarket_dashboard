import { describe, expect, it } from "vitest";

import {
  buildPriceHitExpiryDistributions,
  classifyPriceHitMarketSide,
  extractStrikePrice,
  getDefaultPriceHitExpiry,
  normalizePriceHitMarketsForEvent,
  repairPriceHitCdfProbabilities,
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
  it("prefers the actual text strike over ordinal threshold ranks and falls back when needed", () => {
    expect(extractStrikePrice({ question: "Will Bitcoin reach $110,000 in March?", groupItemThreshold: "1.00" })).toBe(110_000);
    expect(extractStrikePrice({ question: "Will Bitcoin reach $150k this quarter?" })).toBe(150_000);
    expect(extractStrikePrice({ title: "Will Oil hit 82.5 by month-end?" })).toBe(82.5);
    expect(extractStrikePrice({ groupItemThreshold: "120" })).toBe(120);
  });

  it("classifies high and low ladder sides and ignores settlement-style wording", () => {
    expect(classifyPriceHitMarketSide({ question: "Will Bitcoin reach $100k in March?" })).toBe("high");
    expect(classifyPriceHitMarketSide({ question: "Will Bitcoin dip to $60k in March?" })).toBe("low");
    expect(classifyPriceHitMarketSide({ question: "Will Bitcoin settle above $95k in March?" })).toBe(null);
  });

  it("filters for active liquid binary markets and normalizes strike/probability pairs", () => {
    const rawEvent = {
      id: "event-1",
      markets: [
        {
          id: "m-1",
          question: "Will NVDA reach $120 by March?",
          slug: "nvda-120-march",
          groupItemThreshold: "1.00",
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
          question: "Will NVDA dip to $90 by March?",
          slug: "nvda-90-march",
          groupItemThreshold: "2.00",
          active: true,
          closed: false,
          resolved: false,
          outcomes: ["Yes", "No"],
          outcomePrices: "[0.44,0.56]",
          volume24hr: "1500",
          volumeNum: "8000",
          endDate: "2026-03-31T23:59:00Z",
        },
        {
          id: "m-3",
          question: "Will NVDA settle above $115 by March?",
          slug: "nvda-settle-above-115",
          groupItemThreshold: "115",
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
          id: "m-4",
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

    expect(markets).toHaveLength(2);
    expect(markets[0]).toMatchObject({
      marketId: "m-1",
      side: "high",
      strikePrice: 120,
      probability: 0.74,
      expiryDate: "2026-03-31",
    });
    expect(markets[1]).toMatchObject({
      marketId: "m-2",
      side: "low",
      strikePrice: 90,
      probability: 0.44,
      expiryDate: "2026-03-31",
    });
  });
});

describe("price hit distributions", () => {
  it("repairs non-monotone survival probabilities", () => {
    expect(repairPriceHitSurvivalProbabilities([0.8, 0.85, 0.4])).toEqual([0.8, 0.8, 0.4]);
  });

  it("repairs non-monotone low-side cdf probabilities", () => {
    expect(repairPriceHitCdfProbabilities([0.4, 0.35, 0.6])).toEqual([0.4, 0.4, 0.6]);
  });

  it("keeps one event per expiry, dedupes by side+strike, and computes bucket quantiles from that event", () => {
    const markets: PriceHitNormalizedMarket[] = [
      {
        marketId: "m-low-60",
        eventId: "event-a",
        eventTitle: "BTC March",
        title: "Will Bitcoin dip to $60k?",
        side: "low",
        strikePrice: 60_000,
        probability: 0.2,
        volume24hUsd: 5_000,
        volumeTotalUsd: 20_000,
        url: null,
        updatedAt: "2026-03-22T00:00:00.000Z",
        expiryDate: "2026-03-31",
        liquidityScore: 20_000,
      },
      {
        marketId: "m-low-70-weak",
        eventId: "event-a",
        eventTitle: "BTC March",
        title: "Will Bitcoin dip to $70k?",
        side: "low",
        strikePrice: 70_000,
        probability: 0.45,
        volume24hUsd: 1_500,
        volumeTotalUsd: 8_000,
        url: null,
        updatedAt: "2026-03-22T00:00:00.000Z",
        expiryDate: "2026-03-31",
        liquidityScore: 8_000,
      },
      {
        marketId: "m-low-70-strong",
        eventId: "event-a",
        eventTitle: "BTC March",
        title: "Will Bitcoin dip to $70k?",
        side: "low",
        strikePrice: 70_000,
        probability: 0.5,
        volume24hUsd: 4_000,
        volumeTotalUsd: 30_000,
        url: null,
        updatedAt: "2026-03-22T00:00:00.000Z",
        expiryDate: "2026-03-31",
        liquidityScore: 30_000,
      },
      {
        marketId: "m-high-80",
        eventId: "event-a",
        eventTitle: "BTC March",
        title: "Will Bitcoin reach $80k?",
        side: "high",
        strikePrice: 80_000,
        probability: 0.4,
        volume24hUsd: 3_000,
        volumeTotalUsd: 18_000,
        url: null,
        updatedAt: "2026-03-22T00:00:00.000Z",
        expiryDate: "2026-03-31",
        liquidityScore: 18_000,
      },
      {
        marketId: "m-high-100",
        eventId: "event-a",
        eventTitle: "BTC March",
        title: "Will Bitcoin reach $100k?",
        side: "high",
        strikePrice: 100_000,
        probability: 0.1,
        volume24hUsd: 2_000,
        volumeTotalUsd: 16_000,
        url: null,
        updatedAt: "2026-03-22T00:00:00.000Z",
        expiryDate: "2026-03-31",
        liquidityScore: 16_000,
      },
      {
        marketId: "m-b-low-65",
        eventId: "event-b",
        eventTitle: "BTC Alternative March",
        title: "Will Bitcoin dip to $65k?",
        side: "low",
        strikePrice: 65_000,
        probability: 0.35,
        volume24hUsd: 1_000,
        volumeTotalUsd: 6_000,
        url: null,
        updatedAt: "2026-03-22T00:00:00.000Z",
        expiryDate: "2026-03-31",
        liquidityScore: 6_000,
      },
      {
        marketId: "m-b-high-90",
        eventId: "event-b",
        eventTitle: "BTC Alternative March",
        title: "Will Bitcoin reach $90k?",
        side: "high",
        strikePrice: 90_000,
        probability: 0.25,
        volume24hUsd: 1_200,
        volumeTotalUsd: 6_500,
        url: null,
        updatedAt: "2026-03-22T00:00:00.000Z",
        expiryDate: "2026-03-31",
        liquidityScore: 6_500,
      },
    ];

    const [distribution] = buildPriceHitExpiryDistributions(markets);

    expect(distribution).toBeDefined();
    expect(distribution?.eventId).toBe("event-a");
    expect(distribution?.strikeCount).toBe(4);
    expect(distribution?.markets.map((market) => market.marketId)).toEqual([
      "m-low-60",
      "m-low-70-strong",
      "m-high-80",
      "m-high-100",
    ]);
    expect(distribution?.buckets.map((bucket) => Number(bucket.probabilityDensity.toFixed(2)))).toEqual([0.2, 0.3, 0.1, 0.3, 0.1]);
    expect(distribution?.impliedMedianPrice).toBe(70_000);
    expect(distribution?.range90Low).toBe(52_500);
    expect(distribution?.range90High).toBeCloseTo(110_000, 6);
  });

  it("selects the nearest upcoming expiry by default", () => {
    const defaultExpiry = getDefaultPriceHitExpiry(
      [{ expiryDate: "2026-03-01" }, { expiryDate: "2026-04-15" }, { expiryDate: "2026-05-01" }],
      new Date("2026-03-22T00:00:00.000Z"),
    );

    expect(defaultExpiry).toBe("2026-04-15");
  });
});
