import { describe, expect, it } from "vitest";

import { compareByDisplayVolumeDesc, selectDisplayVolume, withDisplayVolume } from "@/lib/polymarket/volume";
import { TopVolumeItem } from "@/lib/polymarket/types";

const item: TopVolumeItem = {
  kind: "market",
  id: "market-1",
  title: "Test",
  status: "active",
  volume24hUsd: 100,
  volumeTotalUsd: 500,
  displayVolumeUsd: null,
  price: 0.4,
  url: null,
  tags: [],
  updatedAt: null,
};

describe("volume helpers", () => {
  it("selects 24h volume", () => {
    expect(selectDisplayVolume(item, "24h")).toBe(100);
  });

  it("selects total volume", () => {
    expect(selectDisplayVolume(item, "total")).toBe(500);
  });

  it("maps display volume over arrays", () => {
    const result = withDisplayVolume([item], "24h");
    expect(result[0].displayVolumeUsd).toBe(100);
  });

  it("sorts nulls to the end", () => {
    const sorted = [
      { ...item, id: "a", displayVolumeUsd: null },
      { ...item, id: "b", displayVolumeUsd: 10 },
      { ...item, id: "c", displayVolumeUsd: 300 },
    ].sort(compareByDisplayVolumeDesc);

    expect(sorted.map((entry) => entry.id)).toEqual(["c", "b", "a"]);
  });
});
