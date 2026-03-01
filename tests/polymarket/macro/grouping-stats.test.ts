import { describe, expect, it } from "vitest";

import { assignMacroBucket, summarizeMacroGroups } from "@/lib/polymarket/macro/grouping";
import { computeMacroStats } from "@/lib/polymarket/macro/stats";
import { MacroMonitorItem } from "@/lib/polymarket/macro/types";

const baseItem: Omit<MacroMonitorItem, "id" | "title" | "bucket"> = {
  status: "active",
  url: null,
  tags: [],
  updatedAt: null,
  volume24hUsd: 100,
  expectationProb: 0.5,
  change1dClob: 0.1,
  change1wClob: -0.2,
  clobMeta: {
    hasToken: true,
    has1dHistory: true,
    has1wHistory: true,
  },
};

describe("assignMacroBucket", () => {
  it("uses deterministic first-match priority", () => {
    expect(assignMacroBucket("Fed rate cut odds", ["Economy"])).toBe("Rates & Fed");
    expect(assignMacroBucket("US CPI print", ["Economy"])).toBe("Inflation");
    expect(assignMacroBucket("Labor market update", ["Finance"])).toBe("Growth & Labor");
    expect(assignMacroBucket("Generic macro question", ["Economy"])).toBe("Other Economy/Finance");
  });

  it("does not place USD/FX markets into Rates & Fed by generic rate terms", () => {
    expect(assignMacroBucket("USD exchange rate against CNY this month", ["Finance"])).toBe("Other Economy/Finance");
  });
});

describe("summarizeMacroGroups and computeMacroStats", () => {
  it("aggregates counts, volume, and coverage metrics", () => {
    const items: MacroMonitorItem[] = [
      {
        ...baseItem,
        id: "1",
        title: "Fed",
        bucket: "Rates & Fed",
      },
      {
        ...baseItem,
        id: "2",
        title: "Inflation",
        bucket: "Inflation",
        volume24hUsd: 200,
        expectationProb: 0.3,
        change1dClob: null,
        clobMeta: {
          hasToken: true,
          has1dHistory: false,
          has1wHistory: true,
        },
      },
    ];

    const groups = summarizeMacroGroups(items);
    const stats = computeMacroStats(items);

    expect(groups.find((group) => group.bucket === "Rates & Fed")?.count).toBe(1);
    expect(groups.find((group) => group.bucket === "Inflation")?.totalVolume24hUsd).toBe(200);

    expect(stats.marketCount).toBe(2);
    expect(stats.totalVolume24hUsd).toBe(300);
    expect(stats.medianExpectationProb).toBe(0.4);
    expect(stats.clobCoverageRate1d).toBe(0.5);
    expect(stats.largestAbsMove1w).toBe(0.2);
  });
});
