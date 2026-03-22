import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/polymarket/watchlist/route";

const fetchMock = vi.fn<typeof fetch>();

describe("GET /api/polymarket/watchlist", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns grouped event data with nested active markets and a summary", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes("/public-search")) {
        return new Response(
          JSON.stringify({
            events: [
              {
                id: "event-1",
                score: "100",
                markets: [
                  {
                    id: "m-high",
                    question: "Will Iran talks restart in 2026?",
                    slug: "iran-talks-restart-2026",
                    active: true,
                    closed: false,
                    resolved: false,
                    score: "98",
                    lastTradePrice: "0.61",
                    outcomes: ["Yes", "No"],
                    outcomePrices: "[0.61,0.39]",
                    volume24hr: "200000",
                    volumeNum: "800000",
                  },
                  {
                    id: "m-fallback",
                    question: "Will US AI regulation pass in 2026?",
                    slug: "us-ai-regulation-2026",
                    active: true,
                    closed: false,
                    resolved: false,
                    score: "97",
                    outcomes: "[\"Yes\",\"No\"]",
                    outcomePrices: "[0.44,0.56]",
                    volume24hr: "150000",
                    volumeNum: "600000",
                  },
                ],
              },
              {
                id: "event-2",
                score: "80",
                markets: [
                  {
                    id: "m-dup",
                    question: "Will the Fed cut rates by June?",
                    slug: "fed-cut-rates-june",
                    active: true,
                    closed: false,
                    resolved: false,
                    score: "79",
                    lastTradePrice: "0.52",
                    outcomes: ["Yes", "No"],
                    outcomePrices: "[0.52,0.48]",
                    volume24hr: "110000",
                    volumeNum: "510000",
                  },
                  {
                    id: "m-high",
                    question: "Duplicate Iran market",
                    slug: "duplicate-iran-market",
                    active: true,
                    closed: false,
                    resolved: false,
                    score: "78",
                    lastTradePrice: "0.59",
                    outcomes: ["Yes", "No"],
                    outcomePrices: "[0.59,0.41]",
                    volume24hr: "100000",
                    volumeNum: "900000",
                  },
                  {
                    id: "m-closed",
                    question: "Closed market",
                    slug: "closed-market",
                    active: true,
                    closed: true,
                    resolved: false,
                    lastTradePrice: "0.1",
                  },
                  {
                    id: "m-resolved",
                    question: "Resolved market",
                    slug: "resolved-market",
                    active: false,
                    closed: false,
                    resolved: true,
                    lastTradePrice: "0.9",
                  },
                ],
              },
            ],
          }),
          { status: 200 },
        );
      }

      if (url.includes("/v1/responses")) {
        return new Response(
          JSON.stringify({
            output_text:
              "The cluster points to a market narrative that still prices meaningful geopolitical and policy movement, but without a single runaway consensus. Traders look confident enough to assign real odds, while the spread across related contracts suggests the topic is live but still contested.",
          }),
          { status: 200 },
        );
      }

      return new Response("not found", { status: 404 });
    });

    const request = new NextRequest("http://localhost/api/polymarket/watchlist?q=Iran&limit=12");
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("s-maxage=15, stale-while-revalidate=30");
    expect(json.query).toBe("Iran");
    expect(json.summaryStatus).toBe("ready");
    expect(json.summary).toContain("market narrative");
    expect(json.events).toHaveLength(2);
    expect(json.events[0].id).toBe("event-1");
    expect(json.events[0].marketCount).toBe(2);
    expect(json.events[0].markets).toHaveLength(2);
    expect(json.events[0].markets[0].id).toBe("m-high");
    expect(json.events[0].markets[1].id).toBe("m-fallback");
    expect(json.events[0].markets[1].yesPrice).toBe(0.44);
    expect(json.events[0].markets[1].noPrice).toBe(0.56);
    expect(json.events[0].markets[1].lastTradePrice).toBe(0.44);
    expect(json.events[1].id).toBe("event-2");
    expect(json.events[1].marketCount).toBe(1);
    expect(json.events[1].markets[0].id).toBe("m-dup");
  });

  it("returns results when the OpenAI summary request fails", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes("/public-search")) {
        return new Response(
          JSON.stringify({
            events: [
              {
                id: "event-1",
                markets: [
                  {
                    id: "m-1",
                    question: "Will Iran sanctions expand?",
                    slug: "iran-sanctions-expand",
                    active: true,
                    closed: false,
                    resolved: false,
                    lastTradePrice: "0.63",
                    outcomes: ["Yes", "No"],
                    outcomePrices: "[0.63,0.37]",
                    volume24hr: "85000",
                    volumeNum: "250000",
                  },
                ],
              },
            ],
          }),
          { status: 200 },
        );
      }

      if (url.includes("/v1/responses")) {
        return new Response(JSON.stringify({ error: { message: "boom" } }), { status: 500 });
      }

      return new Response("not found", { status: 404 });
    });

    const request = new NextRequest("http://localhost/api/polymarket/watchlist?q=Iran");
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.summary).toBeNull();
    expect(json.summaryStatus).toBe("unavailable");
    expect(json.events).toHaveLength(1);
    expect(json.events[0].markets).toHaveLength(1);
  });

  it("returns an empty payload when no active markets match", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          events: [],
        }),
        { status: 200 },
      ),
    );

    const request = new NextRequest("http://localhost/api/polymarket/watchlist?q=Largest%20Company");
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.events).toEqual([]);
    expect(json.summary).toBeNull();
    expect(json.summaryStatus).toBe("unavailable");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns 400 on invalid query parameters", async () => {
    const request = new NextRequest("http://localhost/api/polymarket/watchlist?q=");
    const response = await GET(request);

    expect(response.status).toBe(400);
  });

  it("returns 502 when the upstream search payload is invalid", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));

    const request = new NextRequest("http://localhost/api/polymarket/watchlist?q=Fed");
    const response = await GET(request);

    expect(response.status).toBe(502);
  });
});
