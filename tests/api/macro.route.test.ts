import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/polymarket/macro/route";

const fetchMock = vi.fn<typeof fetch>();

describe("GET /api/polymarket/macro", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("returns grouped macro payload with CLOB changes", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes("gamma-api.polymarket.com")) {
        return new Response(
          JSON.stringify([
            {
              id: "m1",
              question: "Fed rates next meeting",
              volume24hr: "500",
              active: true,
              tags: [{ label: "Economy" }],
              lastTradePrice: "0.62",
              clobTokenIds: '["t1","t2"]',
            },
            {
              id: "m2",
              question: "S&P above level",
              volume24hr: "300",
              active: true,
              tags: [{ label: "Finance" }],
              outcomePrices: "[0.4,0.6]",
              clobTokenIds: '["t3","t4"]',
            },
          ]),
          { status: 200 },
        );
      }

      if (url.includes("interval=1d")) {
        return new Response(JSON.stringify({ history: [{ p: "0.50" }] }), { status: 200 });
      }

      if (url.includes("interval=1w")) {
        return new Response(JSON.stringify({ history: [{ p: "0.45" }] }), { status: 200 });
      }

      return new Response("{}", { status: 404 });
    });

    const request = new NextRequest("http://localhost/api/polymarket/macro?limit=2");
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("s-maxage=15, stale-while-revalidate=30");
    expect(json.items).toHaveLength(2);
    expect(json.items[0].change1dClob).not.toBeNull();
    expect(json.params.includeTagsFixed).toEqual(["economy", "finance"]);
    expect(Array.isArray(json.groups)).toBe(true);
    expect(typeof json.stats.totalVolume24hUsd).toBe("number");
  });

  it("returns 400 on invalid limit", async () => {
    const request = new NextRequest("http://localhost/api/polymarket/macro?limit=0");
    const response = await GET(request);

    expect(response.status).toBe(400);
  });

  it("returns 429 on upstream gamma rate-limit", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 429 }));

    const request = new NextRequest("http://localhost/api/polymarket/macro");
    const response = await GET(request);

    expect(response.status).toBe(429);
  });

  it("keeps rows and returns null deltas when CLOB fails", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes("gamma-api.polymarket.com")) {
        return new Response(
          JSON.stringify([
            {
              id: "m1",
              question: "Inflation nowcast",
              volume24hr: "200",
              active: true,
              tags: [{ label: "Economy" }],
              lastTradePrice: "0.55",
              clobTokenIds: '["t1","t2"]',
            },
          ]),
          { status: 200 },
        );
      }

      return new Response("{}", { status: 500 });
    });

    const request = new NextRequest("http://localhost/api/polymarket/macro");
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.items).toHaveLength(1);
    expect(json.items[0].change1dClob).toBeNull();
    expect(json.items[0].change1wClob).toBeNull();
  });
});
