import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/insider/alerts/route";
import { fetchInsiderAlerts } from "@/lib/insider/supabase";

vi.mock("@/lib/insider/supabase", () => ({
  fetchInsiderAlerts: vi.fn(),
}));

describe("GET /api/insider/alerts", () => {
  beforeEach(() => {
    vi.mocked(fetchInsiderAlerts).mockReset();
  });

  it("returns cached alerts payloads", async () => {
    vi.mocked(fetchInsiderAlerts).mockResolvedValue({
      params: { minScore: 6, limit: 25, marketId: null },
      fetchedAt: "2026-03-22T10:00:00.000Z",
      lastScannedAt: "2026-03-22T09:59:00.000Z",
      summary: {
        totalAlerts: 3,
        highScoreAlerts: 1,
        newWalletAlerts: 2,
      },
      items: [],
    });

    const response = await GET(new NextRequest("http://localhost/api/insider/alerts?minScore=6&limit=25"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("s-maxage=15, stale-while-revalidate=30");
    expect(json.summary.totalAlerts).toBe(3);
    expect(fetchInsiderAlerts).toHaveBeenCalledWith({ minScore: 6, limit: 25, marketId: null });
  });

  it("returns 400 for invalid query params", async () => {
    const response = await GET(new NextRequest("http://localhost/api/insider/alerts?minScore=11"));

    expect(response.status).toBe(400);
    expect(fetchInsiderAlerts).not.toHaveBeenCalled();
  });
});
