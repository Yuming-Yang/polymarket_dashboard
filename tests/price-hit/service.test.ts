import { beforeEach, describe, expect, it, vi } from "vitest";

import { getPriceHitData } from "@/lib/price-hit/service";
import { getPriceHitCache, upsertPriceHitCache } from "@/lib/price-hit/cache";
import { classifyPriceHitEvents } from "@/lib/price-hit/classifier";
import { fetchEventById } from "@/lib/polymarket/client";

vi.mock("@/lib/price-hit/cache", () => ({
  getPriceHitCache: vi.fn(),
  isPriceHitCacheExpired: vi.fn(() => true),
  upsertPriceHitCache: vi.fn(),
}));

vi.mock("@/lib/price-hit/classifier", () => ({
  classifyPriceHitEvents: vi.fn(),
}));

vi.mock("@/lib/polymarket/client", () => ({
  fetchEventById: vi.fn(),
}));

describe("price hit service", () => {
  beforeEach(() => {
    vi.mocked(getPriceHitCache).mockReset();
    vi.mocked(upsertPriceHitCache).mockReset();
    vi.mocked(classifyPriceHitEvents).mockReset();
    vi.mocked(fetchEventById).mockReset();
  });

  it("persists empty AI classifications and returns an empty payload without fetching live events", async () => {
    vi.mocked(getPriceHitCache).mockResolvedValue(null);
    vi.mocked(classifyPriceHitEvents).mockResolvedValue([]);
    vi.mocked(upsertPriceHitCache).mockResolvedValue({
      asset: "bitcoin",
      searchQuery: "Bitcoin",
      events: [],
      refreshedAt: "2026-03-22T00:00:00.000Z",
      expiresAt: "2026-03-29T00:00:00.000Z",
    });

    const response = await getPriceHitData("bitcoin");

    expect(upsertPriceHitCache).toHaveBeenCalledWith(
      expect.objectContaining({
        asset: "bitcoin",
        events: [],
      }),
    );
    expect(fetchEventById).not.toHaveBeenCalled();
    expect(response.structuredEventCount).toBe(0);
    expect(response.expiries).toEqual([]);
    expect(response.aiCacheStatus).toBe("refreshed");
  });
});
