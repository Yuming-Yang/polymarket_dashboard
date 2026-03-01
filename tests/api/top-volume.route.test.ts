import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/polymarket/top-volume/route";

const fetchMock = vi.fn<typeof fetch>();

describe("GET /api/polymarket/top-volume", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("returns sorted default market payload", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: "2",
            question: "Lower",
            volume24hr: "40",
            volume: "400",
            active: true,
          },
          {
            id: "1",
            question: "Higher",
            volume24hr: "120",
            volume: "100",
            active: true,
          },
        ]),
        { status: 200 },
      ),
    );

    const request = new NextRequest("http://localhost/api/polymarket/top-volume?limit=2");
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("s-maxage=15, stale-while-revalidate=30");
    expect(json.items).toHaveLength(2);
    expect(json.items[0].id).toBe("1");
    expect(json.params.entity).toBe("markets");
    expect(json.params.window).toBe("24h");
  });

  it("handles events and total sorting", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify([
          { id: "a", title: "Event A", volume24hr: "10", volume: "100", active: true },
          { id: "b", title: "Event B", volume24hr: "20", volume: "500", active: true },
        ]),
        { status: 200 },
      ),
    );

    const request = new NextRequest(
      "http://localhost/api/polymarket/top-volume?entity=events&window=total&limit=1",
    );
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.items).toHaveLength(1);
    expect(json.items[0].id).toBe("b");
  });

  it("returns 429 on upstream rate limit", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 429 }));

    const request = new NextRequest("http://localhost/api/polymarket/top-volume");
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(429);
    expect(json.error.upstreamStatus).toBe(429);
  });

  it("returns 502 on upstream validation failure", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ invalid: true }), { status: 200 }));

    const request = new NextRequest("http://localhost/api/polymarket/top-volume");
    const response = await GET(request);

    expect(response.status).toBe(502);
  });

  it("normalizes include/exclude tags and applies filtering", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify([
          { id: "1", question: "A", volume24hr: 10, active: true, tags: [{ label: "Politics" }] },
          { id: "2", question: "B", volume24hr: 11, active: true, tags: [{ label: "Sports" }] },
        ]),
        { status: 200 },
      ),
    );

    const request = new NextRequest(
      "http://localhost/api/polymarket/top-volume?includeTags=politics&excludeTags=sports",
    );
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.items).toHaveLength(1);
    expect(json.items[0].id).toBe("1");
  });
});
