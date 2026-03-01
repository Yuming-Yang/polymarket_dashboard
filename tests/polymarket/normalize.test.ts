import { describe, expect, it } from "vitest";

import { normalizeEvent, normalizeMarket } from "@/lib/polymarket/normalize";

describe("normalizeMarket", () => {
  it("uses lastTradePrice first", () => {
    const market = normalizeMarket(
      {
        id: 123,
        question: "Will X happen?",
        active: true,
        volume24hr: "100.5",
        volume: "220.2",
        lastTradePrice: "0.67",
        tags: [{ label: "Politics" }],
        slug: "will-x-happen",
      },
      0,
    );

    expect(market.id).toBe("123");
    expect(market.price).toBe(0.67);
    expect(market.status).toBe("active");
    expect(market.volume24hUsd).toBe(100.5);
    expect(market.volumeTotalUsd).toBe(220.2);
  });

  it("falls back to outcomePrices", () => {
    const market = normalizeMarket(
      {
        question: "Fallback market",
        outcomePrices: "[0.12,0.88]",
      },
      1,
    );

    expect(market.price).toBe(0.12);
    expect(market.id).toBe("market-1");
  });
});

describe("normalizeEvent", () => {
  it("builds stable event objects", () => {
    const event = normalizeEvent(
      {
        title: "Event title",
        resolved: true,
        volume24hr: "45",
        volume: "78",
        tags: [{ label: "Crypto" }],
      },
      2,
    );

    expect(event.kind).toBe("event");
    expect(event.status).toBe("resolved");
    expect(event.volume24hUsd).toBe(45);
    expect(event.volumeTotalUsd).toBe(78);
    expect(event.price).toBeNull();
  });
});
