import { describe, expect, it } from "vitest";

import { compareByAbsPriceChangeDesc, normalizeBreakingMarkets } from "@/lib/polymarket/breaking";
import { BreakingItem } from "@/lib/polymarket/types";

describe("normalizeBreakingMarkets", () => {
  it("extracts 24h changes from oneDayPriceChange", () => {
    const items = normalizeBreakingMarkets(
      [
        {
          id: "a",
          question: "Market A",
          oneDayPriceChange: "0.12",
          lastTradePrice: "0.55",
          volume24hr: "100",
          active: true,
        },
      ],
      "24h",
    );

    expect(items[0].priceChange).toBe(0.12);
    expect(items[0].absPriceChange).toBe(0.12);
    expect(items[0].lastPrice).toBe(0.55);
  });

  it("uses window-specific fields", () => {
    const [hourItem] = normalizeBreakingMarkets(
      [
        {
          id: "b",
          question: "Market B",
          oneHourPriceChange: "-0.02",
          oneDayPriceChange: "0.20",
          active: true,
        },
      ],
      "1h",
    );

    expect(hourItem.priceChange).toBe(-0.02);
    expect(hourItem.absPriceChange).toBe(0.02);
  });

  it("sorts by absolute price move descending", () => {
    const base: Omit<BreakingItem, "id" | "absPriceChange"> = {
      title: "x",
      status: "active",
      window: "24h",
      priceChange: null,
      lastPrice: null,
      volume24hUsd: null,
      tags: [],
      url: null,
      updatedAt: null,
    };

    const sorted: BreakingItem[] = [
      { ...base, id: "1", absPriceChange: 0.01 },
      { ...base, id: "2", absPriceChange: 0.4 },
      { ...base, id: "3", absPriceChange: null },
    ].sort(compareByAbsPriceChangeDesc);

    expect(sorted.map((item) => item.id)).toEqual(["2", "1", "3"]);
  });
});
