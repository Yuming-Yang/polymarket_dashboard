import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/insider/wallet/[address]/route";
import { fetchWalletAlerts } from "@/lib/insider/supabase";

vi.mock("@/lib/insider/supabase", () => ({
  fetchWalletAlerts: vi.fn(),
}));

describe("GET /api/insider/wallet/[address]", () => {
  beforeEach(() => {
    vi.mocked(fetchWalletAlerts).mockReset();
  });

  it("returns wallet aggregates and alert history", async () => {
    vi.mocked(fetchWalletAlerts).mockResolvedValue({
      fetchedAt: "2026-03-22T10:00:00.000Z",
      lastScannedAt: "2026-03-22T09:59:00.000Z",
      wallet: "0xabc",
      stats: null,
      alerts: [],
    });

    const response = await GET(new NextRequest("http://localhost/api/insider/wallet/0xABC"), {
      params: Promise.resolve({ address: "0xABC" }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("s-maxage=15, stale-while-revalidate=30");
    expect(json.wallet).toBe("0xabc");
    expect(fetchWalletAlerts).toHaveBeenCalledWith("0xabc");
  });
});
