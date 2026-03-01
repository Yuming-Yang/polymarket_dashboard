import { MacroMonitorItem, MacroStats } from "@/lib/polymarket/macro/types";

function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

function maxAbs(values: Array<number | null>): number | null {
  let largest: number | null = null;

  for (const value of values) {
    if (value === null) {
      continue;
    }

    const abs = Math.abs(value);
    if (largest === null || abs > largest) {
      largest = abs;
    }
  }

  return largest;
}

export function computeMacroStats(items: MacroMonitorItem[]): MacroStats {
  const marketCount = items.length;
  const totalVolume24hUsd = items.reduce((total, item) => total + (item.volume24hUsd ?? 0), 0);
  const expectationValues = items
    .map((item) => item.expectationProb)
    .filter((value): value is number => value !== null);

  const has1d = items.filter((item) => item.change1dClob !== null).length;
  const has1w = items.filter((item) => item.change1wClob !== null).length;

  return {
    marketCount,
    totalVolume24hUsd,
    largestAbsMove1d: maxAbs(items.map((item) => item.change1dClob)),
    largestAbsMove1w: maxAbs(items.map((item) => item.change1wClob)),
    medianExpectationProb: median(expectationValues),
    clobCoverageRate1d: marketCount === 0 ? 0 : has1d / marketCount,
    clobCoverageRate1w: marketCount === 0 ? 0 : has1w / marketCount,
  };
}
