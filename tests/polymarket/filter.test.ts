import { describe, expect, it } from "vitest";

import { applyTagFilters, parseTagCsv } from "@/lib/polymarket/filter";
import { TopVolumeItem } from "@/lib/polymarket/types";

const baseItem: TopVolumeItem = {
  kind: "market",
  id: "1",
  title: "Item",
  status: "active",
  volume24hUsd: 10,
  volumeTotalUsd: 20,
  displayVolumeUsd: 10,
  price: 0.5,
  url: null,
  tags: [],
  updatedAt: null,
};

describe("parseTagCsv", () => {
  it("normalizes, trims, and deduplicates", () => {
    expect(parseTagCsv(" Politics, sports,politics ,,  CRYPTO  ")).toEqual(["politics", "sports", "crypto"]);
  });
});

describe("applyTagFilters", () => {
  const items: TopVolumeItem[] = [
    { ...baseItem, id: "a", tags: ["Politics", "Elections"] },
    { ...baseItem, id: "b", tags: ["Sports"] },
    { ...baseItem, id: "c", tags: ["Crypto Prices"] },
  ];

  it("keeps only include tags", () => {
    const result = applyTagFilters(items, ["politics"], []);
    expect(result.map((item) => item.id)).toEqual(["a"]);
  });

  it("removes exclude tags", () => {
    const result = applyTagFilters(items, [], ["sports"]);
    expect(result.map((item) => item.id)).toEqual(["a", "c"]);
  });

  it("applies include then exclude semantics", () => {
    const result = applyTagFilters(items, ["politics", "sports"], ["sports"]);
    expect(result.map((item) => item.id)).toEqual(["a"]);
  });
});
