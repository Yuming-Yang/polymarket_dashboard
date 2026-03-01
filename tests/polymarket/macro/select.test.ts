import { describe, expect, it } from "vitest";

import { extractCurrentExpectation } from "@/lib/polymarket/macro/expectation";
import { selectMacroTopMarkets } from "@/lib/polymarket/macro/select";

describe("extractCurrentExpectation", () => {
  it("uses lastTradePrice before outcomePrices", () => {
    expect(
      extractCurrentExpectation({
        lastTradePrice: "0.66",
        outcomePrices: "[0.2,0.8]",
      }),
    ).toBe(0.66);
  });

  it("normalizes percentage-like values from 0-100", () => {
    expect(extractCurrentExpectation({ lastTradePrice: "62" })).toBe(0.62);
  });

  it("falls back to first outcome price", () => {
    expect(extractCurrentExpectation({ outcomePrices: "[0.31,0.69]" })).toBe(0.31);
  });
});

describe("selectMacroTopMarkets", () => {
  it("filters to economy/finance tags, keeps positive volume, and sorts desc", () => {
    const items = selectMacroTopMarkets(
      [
        {
          id: "a",
          question: "Economy A",
          volume24hr: 200,
          tags: [{ label: "Economy" }],
          active: true,
          lastTradePrice: "0.55",
        },
        {
          id: "b",
          question: "Finance B",
          volume24hr: 450,
          tags: [{ label: "finance" }],
          active: true,
          lastTradePrice: "0.35",
        },
        {
          id: "c",
          question: "Other C",
          volume24hr: 999,
          tags: [{ label: "Sports" }],
          active: true,
        },
        {
          id: "d",
          question: "Economy D",
          volume24hr: 0,
          tags: [{ label: "Economy" }],
          active: true,
        },
      ],
    );

    expect(items.map((item) => item.id)).toEqual(["b", "a"]);
    expect(items[0].volume24hUsd).toBe(450);
  });

  it("keeps ranking order from top-volume universe without local slicing", () => {
    const items = selectMacroTopMarkets(
      Array.from({ length: 60 }).map((_, index) => ({
        id: String(index),
        question: `Q${index}`,
        volume24hr: 1000 - index,
        tags: [{ label: "Economy" }],
        active: true,
      })),
    );

    expect(items).toHaveLength(60);
    expect(items[0].id).toBe("0");
    expect(items[59].id).toBe("59");
  });
});
