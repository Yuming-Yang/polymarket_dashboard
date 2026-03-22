import {
  GammaEventRaw,
  GammaMarketRaw,
  PriceHitDistributionBucket,
  PriceHitExpiryDistribution,
  PriceHitMarketItem,
  PriceHitStructuredEvent,
} from "@/lib/polymarket/types";

export const MIN_PRICE_HIT_TOTAL_VOLUME_USD = 5_000;
export const MIN_PRICE_HIT_24H_VOLUME_USD = 1_000;

export type PriceHitNormalizedMarket = PriceHitMarketItem & {
  expiryDate: string;
  liquidityScore: number;
};

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (value === 1) {
      return true;
    }

    if (value === 0) {
      return false;
    }
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }
  }

  return null;
}

function toString(value: unknown): string | null {
  if (typeof value === "string" && value.trim() !== "") {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function normalizeTimestamp(value: unknown) {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeDateOnly(value: unknown) {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const directDateMatch = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (directDateMatch) {
    return directDateMatch[1];
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter((entry) => entry.length > 0);
  }

  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter((entry) => entry.length > 0);
  } catch {
    return [];
  }
}

function parseOutcomePrices(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.map((entry) => toNumber(entry)).filter((entry): entry is number => entry !== null);
  }

  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((entry) => toNumber(entry)).filter((entry): entry is number => entry !== null);
  } catch {
    return [];
  }
}

function toPolymarketUrl(kind: "market" | "event", slug: unknown) {
  const normalizedSlug = toString(slug);
  return normalizedSlug ? `https://polymarket.com/${kind}/${normalizedSlug}` : null;
}

function normalizeYesProbability(rawMarket: GammaMarketRaw) {
  const labels = parseStringArray(rawMarket.outcomes).map((label) => label.toLowerCase());
  const prices = parseOutcomePrices(rawMarket.outcomePrices);

  if (prices.length === 0) {
    return null;
  }

  if (labels.length === prices.length) {
    const yesIndex = labels.findIndex((label) => label === "yes");
    if (yesIndex >= 0) {
      return prices[yesIndex] ?? null;
    }
  }

  return prices[0] ?? null;
}

function clampProbability(value: number) {
  return Math.min(1, Math.max(0, value));
}

function parseStrikeFromText(value: string | null) {
  if (!value) {
    return null;
  }

  const match = value.match(/\$?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.\d+)?|[0-9]+(?:\.\d+)?)([kKmMbB]?)/);
  if (!match) {
    return null;
  }

  const base = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(base) || base <= 0) {
    return null;
  }

  const suffix = match[2]?.toLowerCase();
  const multiplier =
    suffix === "k" ? 1_000 : suffix === "m" ? 1_000_000 : suffix === "b" ? 1_000_000_000 : 1;

  return base * multiplier;
}

function stableId(value: unknown, fallback: string) {
  return toString(value) ?? fallback;
}

function compareNullableNumberDesc(a: number | null, b: number | null) {
  if (a === null && b === null) {
    return 0;
  }

  if (a === null) {
    return 1;
  }

  if (b === null) {
    return -1;
  }

  return b - a;
}

function compareLiquidity(a: PriceHitNormalizedMarket, b: PriceHitNormalizedMarket) {
  const totalVolumeComparison = compareNullableNumberDesc(a.volumeTotalUsd, b.volumeTotalUsd);
  if (totalVolumeComparison !== 0) {
    return totalVolumeComparison;
  }

  const dayVolumeComparison = compareNullableNumberDesc(a.volume24hUsd, b.volume24hUsd);
  if (dayVolumeComparison !== 0) {
    return dayVolumeComparison;
  }

  return a.marketId.localeCompare(b.marketId);
}

function getRepresentativeGap(strikePrices: number[]) {
  const gaps = strikePrices
    .slice(1)
    .map((price, index) => price - strikePrices[index]!)
    .filter((gap) => Number.isFinite(gap) && gap > 0)
    .sort((a, b) => a - b);

  if (gaps.length === 0) {
    return Math.max(1, strikePrices[0] * 0.1);
  }

  return gaps[Math.floor(gaps.length / 2)] ?? gaps[0]!;
}

function formatPriceLabel(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

function buildBuckets(strikePrices: number[], repairedSurvival: number[]) {
  const representativeGap = getRepresentativeGap(strikePrices);
  const firstStrike = strikePrices[0]!;
  const lastStrike = strikePrices[strikePrices.length - 1]!;
  const chartMinPrice = Math.max(0, firstStrike - representativeGap);
  const chartMaxPrice = lastStrike + representativeGap;
  const buckets: PriceHitDistributionBucket[] = [];

  buckets.push({
    key: `lower-${firstStrike}`,
    kind: "lower",
    centerPrice: Math.max(0, firstStrike - representativeGap / 2),
    probabilityDensity: clampProbability(1 - repairedSurvival[0]!),
    label: `< ${formatPriceLabel(firstStrike)}`,
  });

  for (let index = 0; index < strikePrices.length - 1; index += 1) {
    const currentStrike = strikePrices[index]!;
    const nextStrike = strikePrices[index + 1]!;
    buckets.push({
      key: `interior-${currentStrike}-${nextStrike}`,
      kind: "interior",
      centerPrice: (currentStrike + nextStrike) / 2,
      probabilityDensity: clampProbability(repairedSurvival[index]! - repairedSurvival[index + 1]!),
      label: `${formatPriceLabel(currentStrike)} - ${formatPriceLabel(nextStrike)}`,
    });
  }

  buckets.push({
    key: `upper-${lastStrike}`,
    kind: "upper",
    centerPrice: lastStrike + representativeGap / 2,
    probabilityDensity: clampProbability(repairedSurvival[repairedSurvival.length - 1]!),
    label: `>= ${formatPriceLabel(lastStrike)}`,
  });

  return {
    buckets,
    chartMinPrice,
    chartMaxPrice,
  };
}

function interpolateSurvivalQuantile(strikePrices: number[], repairedSurvival: number[], quantile: number) {
  if (strikePrices.length < 2) {
    return null;
  }

  const representativeGap = getRepresentativeGap(strikePrices);
  const chartMinPrice = Math.max(0, strikePrices[0]! - representativeGap);
  const chartMaxPrice = strikePrices[strikePrices.length - 1]! + representativeGap;
  const xValues = [chartMinPrice, ...strikePrices, chartMaxPrice];
  const yValues = [1, ...repairedSurvival, 0];
  const targetSurvival = clampProbability(1 - quantile);

  for (let index = 0; index < xValues.length - 1; index += 1) {
    const x0 = xValues[index]!;
    const x1 = xValues[index + 1]!;
    const y0 = yValues[index]!;
    const y1 = yValues[index + 1]!;

    if (targetSurvival > y0 || targetSurvival < y1) {
      continue;
    }

    if (y0 === y1) {
      return x1;
    }

    const ratio = (y0 - targetSurvival) / (y0 - y1);
    return x0 + ratio * (x1 - x0);
  }

  return quantile <= 0.5 ? chartMinPrice : chartMaxPrice;
}

export function extractStrikePrice(rawMarket: GammaMarketRaw) {
  const threshold = toNumber(rawMarket.groupItemThreshold);
  if (threshold !== null && threshold > 0) {
    return threshold;
  }

  return (
    parseStrikeFromText(toString(rawMarket.groupItemTitle)) ??
    parseStrikeFromText(toString(rawMarket.question)) ??
    parseStrikeFromText(toString(rawMarket.title))
  );
}

export function repairPriceHitSurvivalProbabilities(probabilities: number[]) {
  return probabilities.reduce<number[]>((result, probability, index) => {
    const clamped = clampProbability(probability);
    if (index === 0) {
      result.push(clamped);
      return result;
    }

    result.push(Math.min(result[index - 1]!, clamped));
    return result;
  }, []);
}

export function normalizePriceHitMarketsForEvent(rawEvent: GammaEventRaw, structuredEvent: PriceHitStructuredEvent) {
  return (rawEvent.markets ?? []).reduce<PriceHitNormalizedMarket[]>((result, rawMarket, index) => {
    const outputs = parseStringArray(rawMarket.outcomes);
    const prices = parseOutcomePrices(rawMarket.outcomePrices);

    if (!toBoolean(rawMarket.active) || toBoolean(rawMarket.closed) || toBoolean(rawMarket.resolved)) {
      return result;
    }

    if (Math.max(outputs.length, prices.length) !== 2) {
      return result;
    }

    const strikePrice = extractStrikePrice(rawMarket);
    const probability = normalizeYesProbability(rawMarket);
    const expiryDate = normalizeDateOnly(rawMarket.endDate) ?? structuredEvent.expiryDate;
    const volume24hUsd = toNumber(rawMarket.volume24hr);
    const volumeTotalUsd = toNumber(rawMarket.volumeNum) ?? toNumber(rawMarket.volume);

    if (
      strikePrice === null ||
      probability === null ||
      !expiryDate ||
      ((volumeTotalUsd ?? 0) < MIN_PRICE_HIT_TOTAL_VOLUME_USD && (volume24hUsd ?? 0) < MIN_PRICE_HIT_24H_VOLUME_USD)
    ) {
      return result;
    }

    result.push({
      marketId: stableId(rawMarket.id, `${structuredEvent.eventId}-market-${index}`),
      eventId: structuredEvent.eventId,
      eventTitle: structuredEvent.eventTitle,
      title: toString(rawMarket.question) ?? toString(rawMarket.title) ?? `Strike ${strikePrice}`,
      strikePrice,
      probability: clampProbability(probability),
      volume24hUsd,
      volumeTotalUsd,
      url: toPolymarketUrl("market", rawMarket.slug),
      updatedAt: normalizeTimestamp(rawMarket.updatedAt),
      expiryDate,
      liquidityScore: volumeTotalUsd ?? volume24hUsd ?? 0,
    });

    return result;
  }, []);
}

export function buildPriceHitExpiryDistributions(markets: PriceHitNormalizedMarket[]): PriceHitExpiryDistribution[] {
  const groupedByExpiry = new Map<string, Map<number, PriceHitNormalizedMarket>>();

  for (const market of markets) {
    const marketsByStrike = groupedByExpiry.get(market.expiryDate) ?? new Map<number, PriceHitNormalizedMarket>();
    const current = marketsByStrike.get(market.strikePrice);

    if (!current || compareLiquidity(market, current) < 0) {
      marketsByStrike.set(market.strikePrice, market);
    }

    groupedByExpiry.set(market.expiryDate, marketsByStrike);
  }

  return Array.from(groupedByExpiry.entries())
    .map(([expiryDate, uniqueMarkets]) => {
      const sortedMarkets = Array.from(uniqueMarkets.values()).sort((a, b) => {
        if (a.strikePrice !== b.strikePrice) {
          return a.strikePrice - b.strikePrice;
        }

        return compareLiquidity(a, b);
      });

      if (sortedMarkets.length < 2) {
        return null;
      }

      const strikePrices = sortedMarkets.map((market) => market.strikePrice);
      const repairedSurvival = repairPriceHitSurvivalProbabilities(sortedMarkets.map((market) => market.probability));
      const { buckets, chartMinPrice, chartMaxPrice } = buildBuckets(strikePrices, repairedSurvival);

      return {
        expiryDate,
        strikeCount: sortedMarkets.length,
        impliedMedianPrice: interpolateSurvivalQuantile(strikePrices, repairedSurvival, 0.5),
        range90Low: interpolateSurvivalQuantile(strikePrices, repairedSurvival, 0.05),
        range90High: interpolateSurvivalQuantile(strikePrices, repairedSurvival, 0.95),
        chartMinPrice,
        chartMaxPrice,
        strikePrices,
        buckets,
        markets: sortedMarkets.map((market) => ({
          marketId: market.marketId,
          eventId: market.eventId,
          eventTitle: market.eventTitle,
          title: market.title,
          strikePrice: market.strikePrice,
          probability: market.probability,
          volume24hUsd: market.volume24hUsd,
          volumeTotalUsd: market.volumeTotalUsd,
          url: market.url,
          updatedAt: market.updatedAt,
        })),
      } satisfies PriceHitExpiryDistribution;
    })
    .filter((distribution): distribution is PriceHitExpiryDistribution => distribution !== null)
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
}

export function getDefaultPriceHitExpiry(expiries: Pick<PriceHitExpiryDistribution, "expiryDate">[], now = new Date()) {
  if (expiries.length === 0) {
    return null;
  }

  const today = now.toISOString().slice(0, 10);
  const upcoming = expiries.find((expiry) => expiry.expiryDate >= today);
  return upcoming?.expiryDate ?? expiries[0]!.expiryDate;
}
