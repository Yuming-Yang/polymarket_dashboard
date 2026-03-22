import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/polymarket/price-hit/refresh/route";
import { refreshAllPriceHitAssets } from "@/lib/price-hit/service";

vi.mock("@/lib/price-hit/service", () => ({
  refreshAllPriceHitAssets: vi.fn(),
}));

describe("POST /api/polymarket/price-hit/refresh", () => {
  beforeEach(() => {
    vi.mocked(refreshAllPriceHitAssets).mockReset();
  });

  it("returns per-asset refresh status payloads", async () => {
    vi.mocked(refreshAllPriceHitAssets).mockResolvedValue({
      fetchedAt: "2026-03-22T00:00:00.000Z",
      ok: false,
      results: [
        {
          asset: "bitcoin",
          assetLabel: "BTC",
          ok: true,
          status: "refreshed",
          structuredEventCount: 3,
          refreshedAt: "2026-03-22T00:00:00.000Z",
          expiresAt: "2026-03-29T00:00:00.000Z",
          message: null,
        },
        {
          asset: "gold",
          assetLabel: "Gold",
          ok: false,
          status: "failed",
          structuredEventCount: 0,
          refreshedAt: null,
          expiresAt: null,
          message: "boom",
        },
      ],
    });

    const response = await POST();
    const json = await response.json();

    expect(response.status).toBe(502);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(json.results).toHaveLength(2);
    expect(json.results[0].status).toBe("refreshed");
    expect(json.results[1].status).toBe("failed");
  });
});
