import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/polymarket/price-hit/route";
import { classifyPriceHitEvents } from "@/lib/price-hit/classifier";
import { getPriceHitCache, isPriceHitCacheExpired, upsertPriceHitCache } from "@/lib/price-hit/cache";
import { fetchEventById } from "@/lib/polymarket/client";

vi.mock("@/lib/price-hit/cache", () => ({
  getPriceHitCache: vi.fn(),
  isPriceHitCacheExpired: vi.fn(),
  upsertPriceHitCache: vi.fn(),
}));

vi.mock("@/lib/price-hit/classifier", () => ({
  classifyPriceHitEvents: vi.fn(),
}));

vi.mock("@/lib/polymarket/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/polymarket/client")>("@/lib/polymarket/client");
  return {
    ...actual,
    fetchEventById: vi.fn(),
  };
});

function buildEventDetail(markets: Array<Record<string, unknown>>) {
  return {
    id: "event-1",
    title: "Bitcoin March Targets",
    endDate: "2026-03-31",
    markets,
  };
}

describe("GET /api/polymarket/price-hit", () => {
  beforeEach(() => {
    vi.mocked(getPriceHitCache).mockReset();
    vi.mocked(isPriceHitCacheExpired).mockReset();
    vi.mocked(upsertPriceHitCache).mockReset();
    vi.mocked(classifyPriceHitEvents).mockReset();
    vi.mocked(fetchEventById).mockReset();
  });

  it("returns cached data with live market pricing", async () => {
    vi.mocked(getPriceHitCache).mockResolvedValue({
      asset: "bitcoin",
      searchQuery: "Bitcoin",
      events: [
        {
          asset: "bitcoin",
          eventId: "event-1",
          eventSlug: "bitcoin-march-targets",
          eventTitle: "Bitcoin March Targets",
          expiryDate: "2026-03-31",
        },
      ],
      refreshedAt: "2026-03-22T00:00:00.000Z",
      expiresAt: "2026-03-29T00:00:00.000Z",
    });
    vi.mocked(isPriceHitCacheExpired).mockReturnValue(false);
    vi.mocked(fetchEventById).mockResolvedValue(
      buildEventDetail([
        {
          id: "m-1",
          question: "Will Bitcoin reach $100k?",
          slug: "btc-100k",
          groupItemThreshold: "100000",
          active: true,
          closed: false,
          resolved: false,
          outcomes: ["Yes", "No"],
          outcomePrices: "[0.8,0.2]",
          volume24hr: "2000",
          volumeNum: "10000",
          endDate: "2026-03-31",
        },
        {
          id: "m-2",
          question: "Will Bitcoin dip to $60k?",
          slug: "btc-60k",
          groupItemThreshold: "60000",
          active: true,
          closed: false,
          resolved: false,
          outcomes: ["Yes", "No"],
          outcomePrices: "[0.2,0.8]",
          volume24hr: "3000",
          volumeNum: "16000",
          endDate: "2026-03-31",
        },
      ]),
    );

    const response = await GET(new NextRequest("http://localhost/api/polymarket/price-hit?asset=bitcoin"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(json.aiCacheStatus).toBe("cache_hit");
    expect(json.expiries).toHaveLength(1);
    expect(json.expiries[0].events[0].strikeCount).toBe(2);
    expect(classifyPriceHitEvents).not.toHaveBeenCalled();
  });

  it("refreshes stale cache entries through the AI classifier", async () => {
    vi.mocked(getPriceHitCache).mockResolvedValue({
      asset: "bitcoin",
      searchQuery: "Bitcoin",
      events: [],
      refreshedAt: "2026-03-10T00:00:00.000Z",
      expiresAt: "2026-03-17T00:00:00.000Z",
    });
    vi.mocked(isPriceHitCacheExpired).mockReturnValue(true);
    vi.mocked(classifyPriceHitEvents).mockResolvedValue([
      {
        asset: "bitcoin",
        eventId: "event-2",
        eventSlug: "bitcoin-april-targets",
        eventTitle: "Bitcoin April Targets",
        expiryDate: "2026-04-30",
      },
    ]);
    vi.mocked(upsertPriceHitCache).mockResolvedValue({
      asset: "bitcoin",
      searchQuery: "Bitcoin",
      events: [
        {
          asset: "bitcoin",
          eventId: "event-2",
          eventSlug: "bitcoin-april-targets",
          eventTitle: "Bitcoin April Targets",
          expiryDate: "2026-04-30",
        },
      ],
      refreshedAt: "2026-03-22T00:00:00.000Z",
      expiresAt: "2026-03-29T00:00:00.000Z",
    });
    vi.mocked(fetchEventById).mockResolvedValue(
      buildEventDetail([
        {
          id: "m-1",
          question: "Will Bitcoin reach $110k?",
          slug: "btc-110k",
          groupItemThreshold: "110000",
          active: true,
          closed: false,
          resolved: false,
          outcomes: ["Yes", "No"],
          outcomePrices: "[0.7,0.3]",
          volume24hr: "3000",
          volumeNum: "13000",
          endDate: "2026-04-30",
        },
        {
          id: "m-2",
          question: "Will Bitcoin dip to $70k?",
          slug: "btc-70k",
          groupItemThreshold: "70000",
          active: true,
          closed: false,
          resolved: false,
          outcomes: ["Yes", "No"],
          outcomePrices: "[0.25,0.75]",
          volume24hr: "3000",
          volumeNum: "13000",
          endDate: "2026-04-30",
        },
      ]),
    );

    const response = await GET(new NextRequest("http://localhost/api/polymarket/price-hit?asset=bitcoin"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.aiCacheStatus).toBe("refreshed");
    expect(json.defaultEventId).toBe("event-2");
    expect(upsertPriceHitCache).toHaveBeenCalledTimes(1);
    expect(fetchEventById).toHaveBeenCalledWith({ eventId: "event-2", noStore: true });
  });

  it("falls back to stale cache data when refresh fails", async () => {
    vi.mocked(getPriceHitCache).mockResolvedValue({
      asset: "bitcoin",
      searchQuery: "Bitcoin",
      events: [
        {
          asset: "bitcoin",
          eventId: "event-1",
          eventSlug: "bitcoin-march-targets",
          eventTitle: "Bitcoin March Targets",
          expiryDate: "2026-03-31",
        },
      ],
      refreshedAt: "2026-03-10T00:00:00.000Z",
      expiresAt: "2026-03-17T00:00:00.000Z",
    });
    vi.mocked(isPriceHitCacheExpired).mockReturnValue(true);
    vi.mocked(classifyPriceHitEvents).mockRejectedValue(new Error("OpenAI down"));
    vi.mocked(fetchEventById).mockResolvedValue(
      buildEventDetail([
        {
          id: "m-1",
          question: "Will Bitcoin reach $100k?",
          slug: "btc-100k",
          groupItemThreshold: "100000",
          active: true,
          closed: false,
          resolved: false,
          outcomes: ["Yes", "No"],
          outcomePrices: "[0.72,0.28]",
          volume24hr: "2500",
          volumeNum: "12500",
          endDate: "2026-03-31",
        },
        {
          id: "m-2",
          question: "Will Bitcoin dip to $60k?",
          slug: "btc-60k",
          groupItemThreshold: "60000",
          active: true,
          closed: false,
          resolved: false,
          outcomes: ["Yes", "No"],
          outcomePrices: "[0.22,0.78]",
          volume24hr: "2500",
          volumeNum: "12500",
          endDate: "2026-03-31",
        },
      ]),
    );

    const response = await GET(new NextRequest("http://localhost/api/polymarket/price-hit?asset=bitcoin"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.aiCacheStatus).toBe("stale_fallback");
    expect(upsertPriceHitCache).not.toHaveBeenCalled();
  });

  it("returns a 200 empty payload when no valid liquid markets remain", async () => {
    vi.mocked(getPriceHitCache).mockResolvedValue({
      asset: "bitcoin",
      searchQuery: "Bitcoin",
      events: [
        {
          asset: "bitcoin",
          eventId: "event-1",
          eventSlug: "bitcoin-march-targets",
          eventTitle: "Bitcoin March Targets",
          expiryDate: "2026-03-31",
        },
      ],
      refreshedAt: "2026-03-22T00:00:00.000Z",
      expiresAt: "2026-03-29T00:00:00.000Z",
    });
    vi.mocked(isPriceHitCacheExpired).mockReturnValue(false);
    vi.mocked(fetchEventById).mockResolvedValue(
      buildEventDetail([
        {
          id: "m-1",
          question: "Will Bitcoin reach $100k?",
          slug: "btc-100k",
          groupItemThreshold: "100000",
          active: true,
          closed: false,
          resolved: false,
          outcomes: ["Yes", "No"],
          outcomePrices: "[0.72,0.28]",
          volume24hr: "20",
          volumeNum: "120",
          endDate: "2026-03-31",
        },
        {
          id: "m-2",
          question: "Will Bitcoin reach $120k?",
          slug: "btc-120k",
          groupItemThreshold: "120000",
          active: true,
          closed: false,
          resolved: false,
          outcomes: ["Yes", "No"],
          outcomePrices: "[0.4,0.6]",
          volume24hr: "20",
          volumeNum: "120",
          endDate: "2026-03-31",
        },
      ]),
    );

    const response = await GET(new NextRequest("http://localhost/api/polymarket/price-hit?asset=bitcoin"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.structuredEventCount).toBe(1);
    expect(json.expiries).toEqual([]);
  });
});
