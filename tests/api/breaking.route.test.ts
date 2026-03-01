import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/polymarket/breaking/route";

const fetchMock = vi.fn<typeof fetch>();

describe("GET /api/polymarket/breaking", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("returns top movers sorted by abs change", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: "low",
            question: "Low move",
            oneDayPriceChange: "0.05",
            active: true,
          },
          {
            id: "high",
            question: "High move",
            oneDayPriceChange: "-0.3",
            active: true,
          },
        ]),
        { status: 200 },
      ),
    );

    const request = new NextRequest("http://localhost/api/polymarket/breaking?window=24h&limit=1");
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("s-maxage=15, stale-while-revalidate=30");
    expect(json.items).toHaveLength(1);
    expect(json.items[0].id).toBe("high");
  });

  it("applies include/exclude tag filters", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: "1",
            question: "A",
            oneDayPriceChange: "0.1",
            tags: [{ label: "Politics" }],
            active: true,
          },
          {
            id: "2",
            question: "B",
            oneDayPriceChange: "0.2",
            tags: [{ label: "Sports" }],
            active: true,
          },
        ]),
        { status: 200 },
      ),
    );

    const request = new NextRequest(
      "http://localhost/api/polymarket/breaking?includeTags=politics&excludeTags=sports",
    );
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.items).toHaveLength(1);
    expect(json.items[0].id).toBe("1");
  });

  it("returns 429 on upstream rate limit", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 429 }));

    const request = new NextRequest("http://localhost/api/polymarket/breaking");
    const response = await GET(request);

    expect(response.status).toBe(429);
  });

  it("returns 502 on validation failures", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ invalid: true }), { status: 200 }));

    const request = new NextRequest("http://localhost/api/polymarket/breaking");
    const response = await GET(request);

    expect(response.status).toBe(502);
  });
});
