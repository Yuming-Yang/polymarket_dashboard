import { GammaMarketRaw } from "@/lib/polymarket/types";

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parseOutcomePrices(rawOutcomePrices: unknown): number[] {
  if (Array.isArray(rawOutcomePrices)) {
    return rawOutcomePrices.map((value) => toNumber(value)).filter((value): value is number => value !== null);
  }

  if (typeof rawOutcomePrices !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(rawOutcomePrices) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((value) => toNumber(value)).filter((value): value is number => value !== null);
  } catch {
    return [];
  }
}

function normalizeProbability(value: number): number | null {
  if (!Number.isFinite(value)) {
    return null;
  }

  const normalized = value > 1 && value <= 100 ? value / 100 : value;
  const clamped = Math.min(1, Math.max(0, normalized));
  return Number.isFinite(clamped) ? clamped : null;
}

export function extractCurrentExpectation(rawMarket: GammaMarketRaw): number | null {
  const fromLastTradePrice = toNumber(rawMarket.lastTradePrice);
  if (fromLastTradePrice !== null) {
    return normalizeProbability(fromLastTradePrice);
  }

  const outcomePrices = parseOutcomePrices(rawMarket.outcomePrices);
  if (outcomePrices.length === 0) {
    return null;
  }

  return normalizeProbability(outcomePrices[0]);
}
