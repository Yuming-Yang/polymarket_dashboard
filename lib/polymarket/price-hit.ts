import {
  GammaEventRaw,
  GammaMarketRaw,
  PriceHitDistributionBucket,
  PriceHitEventDistribution,
  PriceHitExpiryGroup,
  PriceHitMarketItem,
  PriceHitMarketSide,
  PriceHitStructuredEvent,
} from "@/lib/polymarket/types";

export const MIN_PRICE_HIT_TOTAL_VOLUME_USD = 5_000;
export const MIN_PRICE_HIT_24H_VOLUME_USD = 1_000;
const MIN_REASONABLE_FALLBACK_STRIKE = 10;
const EXCLUDED_MARKET_PATTERN =
  /\b(above|below|settle|settles|settlement|close above|close below|closing above|closing below|between|range|band|finish above|finish below)\b/i;
const LOW_SIDE_PATTERN = /\b(dip to|hit\s*\(?low\)?|fall to|falls to|drop to|drops to|low\))\b/i;
const HIGH_SIDE_PATTERN = /\b(reach|reaches|touch|touches|hit\s*\(?high\)?|high\)|hit)\b/i;

export type PriceHitNormalizedMarket = PriceHitMarketItem & {
  expiryDate: string;
  liquidityScore: number;
};

type PriceHitNormalizedEvent = {
  eventId: string;
  eventTitle: string;
  expiryDate: string;
  markets: PriceHitNormalizedMarket[];
  totalLiquidity: number;
  lowStrikeCount: number;
  highStrikeCount: number;
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

function parseStrikeMatch(baseValue: string, suffixValue?: string) {
  const base = Number(baseValue.replace(/,/g, ""));
  if (!Number.isFinite(base) || base <= 0) {
    return null;
  }

  const suffix = suffixValue?.toLowerCase();
  const multiplier =
    suffix === "k" ? 1_000 : suffix === "m" ? 1_000_000 : suffix === "b" ? 1_000_000_000 : 1;

  return base * multiplier;
}

function parseStrikeFromText(value: string | null) {
  if (!value) {
    return null;
  }

  const currencyMatch = value.match(/\$\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.\d+)?|[0-9]+(?:\.\d+)?)([kKmMbB]?)/);
  if (currencyMatch) {
    return parseStrikeMatch(currencyMatch[1]!, currencyMatch[2]);
  }

  const contextualMatch = value.match(
    /\b(?:reach|reaches|touch|touches|hit(?:\s*\((?:high|low)\))?|dip to|fall to|falls to|drop to|drops to)\s*\$?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.\d+)?|[0-9]+(?:\.\d+)?)([kKmMbB]?)/i,
  );
  if (contextualMatch) {
    return parseStrikeMatch(contextualMatch[1]!, contextualMatch[2]);
  }

  const leadingPriceMatch = value.match(/^[^\d$]*\$?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.\d+)?|[0-9]+(?:\.\d+)?)([kKmMbB]?)/);
  if (leadingPriceMatch) {
    return parseStrikeMatch(leadingPriceMatch[1]!, leadingPriceMatch[2]);
  }

  return null;
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

function buildBucket(
  key: string,
  kind: PriceHitDistributionBucket["kind"],
  startPrice: number,
  endPrice: number,
  probabilityDensity: number,
  label: string,
): PriceHitDistributionBucket | null {
  const safeStart = Math.min(startPrice, endPrice);
  const safeEnd = Math.max(startPrice, endPrice);

  if (!Number.isFinite(safeStart) || !Number.isFinite(safeEnd) || safeEnd <= safeStart) {
    return null;
  }

  return {
    key,
    kind,
    startPrice: safeStart,
    endPrice: safeEnd,
    centerPrice: (safeStart + safeEnd) / 2,
    probabilityDensity: clampProbability(probabilityDensity),
    label,
  };
}

function normalizeBucketMasses(buckets: PriceHitDistributionBucket[]) {
  const totalMass = buckets.reduce((sum, bucket) => sum + bucket.probabilityDensity, 0);

  if (totalMass <= 0) {
    return buckets;
  }

  return buckets.map((bucket) => ({
    ...bucket,
    probabilityDensity: clampProbability(bucket.probabilityDensity / totalMass),
  }));
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

export function repairPriceHitCdfProbabilities(probabilities: number[]) {
  return probabilities.reduce<number[]>((result, probability, index) => {
    const clamped = clampProbability(probability);
    if (index === 0) {
      result.push(clamped);
      return result;
    }

    result.push(Math.max(result[index - 1]!, clamped));
    return result;
  }, []);
}

function normalizeMarketDescriptor(rawMarket: GammaMarketRaw) {
  return [toString(rawMarket.question), toString(rawMarket.title), toString(rawMarket.groupItemTitle)]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function classifyPriceHitMarketSide(rawMarket: GammaMarketRaw): PriceHitMarketSide | null {
  const descriptor = normalizeMarketDescriptor(rawMarket);
  if (!descriptor) {
    return null;
  }

  if (EXCLUDED_MARKET_PATTERN.test(descriptor)) {
    return null;
  }

  if (descriptor.includes("↓") || LOW_SIDE_PATTERN.test(descriptor)) {
    return "low";
  }

  if (descriptor.includes("↑") || HIGH_SIDE_PATTERN.test(descriptor)) {
    return "high";
  }

  return null;
}

export function extractStrikePrice(rawMarket: GammaMarketRaw) {
  const textStrike =
    parseStrikeFromText(toString(rawMarket.question)) ??
    parseStrikeFromText(toString(rawMarket.title)) ??
    parseStrikeFromText(toString(rawMarket.groupItemTitle));

  if (textStrike !== null) {
    return textStrike;
  }

  const threshold = toNumber(rawMarket.groupItemThreshold);
  if (threshold !== null && threshold >= MIN_REASONABLE_FALLBACK_STRIKE) {
    return threshold;
  }

  return null;
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

    const side = classifyPriceHitMarketSide(rawMarket);
    const strikePrice = extractStrikePrice(rawMarket);
    const probability = normalizeYesProbability(rawMarket);
    const expiryDate = normalizeDateOnly(rawMarket.endDate) ?? structuredEvent.expiryDate;
    const volume24hUsd = toNumber(rawMarket.volume24hr);
    const volumeTotalUsd = toNumber(rawMarket.volumeNum) ?? toNumber(rawMarket.volume);

    if (
      side === null ||
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
      side,
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

function compareMarketsByStrikeAndSide(a: PriceHitNormalizedMarket, b: PriceHitNormalizedMarket) {
  if (a.strikePrice !== b.strikePrice) {
    return a.strikePrice - b.strikePrice;
  }

  if (a.side !== b.side) {
    return a.side === "low" ? -1 : 1;
  }

  return compareLiquidity(a, b);
}

function compareEventStrength(a: PriceHitNormalizedEvent, b: PriceHitNormalizedEvent) {
  const balancedStrikeCountComparison = Math.min(b.lowStrikeCount, b.highStrikeCount) - Math.min(a.lowStrikeCount, a.highStrikeCount);
  if (balancedStrikeCountComparison !== 0) {
    return balancedStrikeCountComparison;
  }

  if (b.markets.length !== a.markets.length) {
    return b.markets.length - a.markets.length;
  }

  if (b.totalLiquidity !== a.totalLiquidity) {
    return b.totalLiquidity - a.totalLiquidity;
  }

  return a.eventId.localeCompare(b.eventId);
}

function buildEventCandidates(markets: PriceHitNormalizedMarket[]) {
  const eventsByKey = new Map<string, Map<string, PriceHitNormalizedMarket>>();

  for (const market of markets) {
    const eventKey = `${market.expiryDate}::${market.eventId}`;
    const marketsByStrike = eventsByKey.get(eventKey) ?? new Map<string, PriceHitNormalizedMarket>();
    const current = marketsByStrike.get(`${market.side}:${market.strikePrice}`);

    if (!current || compareLiquidity(market, current) < 0) {
      marketsByStrike.set(`${market.side}:${market.strikePrice}`, market);
    }

    eventsByKey.set(eventKey, marketsByStrike);
  }

  const groupedByExpiry = new Map<string, PriceHitNormalizedEvent[]>();

  for (const [eventKey, uniqueMarkets] of eventsByKey.entries()) {
    const [expiryDate] = eventKey.split("::");
    const sortedMarkets = Array.from(uniqueMarkets.values()).sort(compareMarketsByStrikeAndSide);
    const lowStrikeCount = sortedMarkets.filter((market) => market.side === "low").length;
    const highStrikeCount = sortedMarkets.filter((market) => market.side === "high").length;

    if (lowStrikeCount === 0 || highStrikeCount === 0 || sortedMarkets.length < 2) {
      continue;
    }

    const candidate: PriceHitNormalizedEvent = {
      eventId: sortedMarkets[0]!.eventId,
      eventTitle: sortedMarkets[0]!.eventTitle,
      expiryDate,
      markets: sortedMarkets,
      totalLiquidity: sortedMarkets.reduce((sum, market) => sum + market.liquidityScore, 0),
      lowStrikeCount,
      highStrikeCount,
    };

    const candidates = groupedByExpiry.get(expiryDate) ?? [];
    candidates.push(candidate);
    groupedByExpiry.set(expiryDate, candidates);
  }

  return Array.from(groupedByExpiry.entries()).map(([expiryDate, candidates]) => ({
    expiryDate,
    events: [...candidates].sort(compareEventStrength),
  }));
}

function buildDistributionBuckets(markets: PriceHitNormalizedMarket[]) {
  const lowMarkets = markets.filter((market) => market.side === "low").sort((a, b) => a.strikePrice - b.strikePrice);
  const highMarkets = markets.filter((market) => market.side === "high").sort((a, b) => a.strikePrice - b.strikePrice);

  if (lowMarkets.length === 0 || highMarkets.length === 0) {
    return null;
  }

  const lowStrikes = lowMarkets.map((market) => market.strikePrice);
  const highStrikes = highMarkets.map((market) => market.strikePrice);
  const lowGap = getRepresentativeGap(lowStrikes);
  const highGap = getRepresentativeGap(highStrikes);
  const chartMinPrice = Math.max(0, lowStrikes[0]! - lowGap);
  const chartMaxPrice = highStrikes[highStrikes.length - 1]! + highGap;
  const repairedLow = repairPriceHitCdfProbabilities(lowMarkets.map((market) => market.probability));
  const repairedHigh = repairPriceHitSurvivalProbabilities(highMarkets.map((market) => market.probability));
  const buckets: PriceHitDistributionBucket[] = [];

  for (let index = 0; index < lowStrikes.length; index += 1) {
    const strikePrice = lowStrikes[index]!;
    const previousStrike = index === 0 ? chartMinPrice : lowStrikes[index - 1]!;
    const previousProbability = index === 0 ? 0 : repairedLow[index - 1]!;
    const bucket = buildBucket(
      `low-${index}-${strikePrice}`,
      "lower",
      previousStrike,
      strikePrice,
      repairedLow[index]! - previousProbability,
      index === 0 ? `< ${formatPriceLabel(strikePrice)}` : `${formatPriceLabel(previousStrike)} - ${formatPriceLabel(strikePrice)}`,
    );

    if (bucket) {
      buckets.push(bucket);
    }
  }

  const centerStart = lowStrikes[lowStrikes.length - 1]!;
  const centerEnd = highStrikes[0]!;
  const centerBucket = buildBucket(
    `center-${centerStart}-${centerEnd}`,
    "interior",
    centerStart,
    centerEnd,
    1 - repairedLow[repairedLow.length - 1]! - repairedHigh[0]!,
    `${formatPriceLabel(centerStart)} - ${formatPriceLabel(centerEnd)}`,
  );

  if (centerBucket) {
    buckets.push(centerBucket);
  }

  for (let index = 0; index < highStrikes.length; index += 1) {
    const strikePrice = highStrikes[index]!;
    const nextStrike = index === highStrikes.length - 1 ? chartMaxPrice : highStrikes[index + 1]!;
    const nextProbability = index === highStrikes.length - 1 ? 0 : repairedHigh[index + 1]!;
    const bucket = buildBucket(
      `high-${index}-${strikePrice}`,
      "upper",
      strikePrice,
      nextStrike,
      repairedHigh[index]! - nextProbability,
      index === highStrikes.length - 1
        ? `>= ${formatPriceLabel(strikePrice)}`
        : `${formatPriceLabel(strikePrice)} - ${formatPriceLabel(nextStrike)}`,
    );

    if (bucket) {
      buckets.push(bucket);
    }
  }

  return {
    chartMinPrice,
    chartMaxPrice,
    strikePrices: [...lowStrikes, ...highStrikes].sort((a, b) => a - b),
    buckets: normalizeBucketMasses(
      buckets
        .map((bucket) => ({
          ...bucket,
          probabilityDensity: clampProbability(bucket.probabilityDensity),
        }))
        .filter((bucket) => bucket.probabilityDensity > 0),
    ),
  };
}

function interpolateBucketQuantile(buckets: PriceHitDistributionBucket[], quantile: number) {
  if (buckets.length === 0) {
    return null;
  }

  const target = clampProbability(quantile);
  let cumulative = 0;

  for (const bucket of buckets) {
    const nextCumulative = cumulative + bucket.probabilityDensity;
    if (target <= nextCumulative || bucket === buckets[buckets.length - 1]) {
      if (bucket.probabilityDensity <= 0) {
        return bucket.endPrice;
      }

      const ratio = clampProbability((target - cumulative) / bucket.probabilityDensity);
      return bucket.startPrice + ratio * (bucket.endPrice - bucket.startPrice);
    }

    cumulative = nextCumulative;
  }

  return buckets[buckets.length - 1]!.endPrice;
}

function buildEventDistribution(event: PriceHitNormalizedEvent): PriceHitEventDistribution | null {
  const chart = buildDistributionBuckets(event.markets);

  if (!chart || chart.buckets.length === 0) {
    return null;
  }

  return {
    expiryDate: event.expiryDate,
    eventId: event.eventId,
    eventTitle: event.eventTitle,
    strikeCount: event.markets.length,
    impliedMedianPrice: interpolateBucketQuantile(chart.buckets, 0.5),
    range90Low: interpolateBucketQuantile(chart.buckets, 0.05),
    range90High: interpolateBucketQuantile(chart.buckets, 0.95),
    chartMinPrice: chart.chartMinPrice,
    chartMaxPrice: chart.chartMaxPrice,
    strikePrices: chart.strikePrices,
    buckets: chart.buckets,
    markets: event.markets.map((market) => ({
      marketId: market.marketId,
      eventId: market.eventId,
      eventTitle: market.eventTitle,
      title: market.title,
      side: market.side,
      strikePrice: market.strikePrice,
      probability: market.probability,
      volume24hUsd: market.volume24hUsd,
      volumeTotalUsd: market.volumeTotalUsd,
      url: market.url,
      updatedAt: market.updatedAt,
    })),
  } satisfies PriceHitEventDistribution;
}

export function buildPriceHitExpiryGroups(markets: PriceHitNormalizedMarket[]): PriceHitExpiryGroup[] {
  const grouped = new Map<string, PriceHitEventDistribution[]>();

  for (const { expiryDate, events } of buildEventCandidates(markets)) {
    for (const event of events) {
      const distribution = buildEventDistribution(event);
      if (!distribution) {
        continue;
      }

      const existingEvents = grouped.get(expiryDate) ?? [];
      existingEvents.push(distribution);
      grouped.set(expiryDate, existingEvents);
    }
  }

  return Array.from(grouped.entries())
    .map(([expiryDate, events]) => ({
      expiryDate,
      events,
    }))
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
}

export function getDefaultPriceHitExpiry(expiries: Pick<PriceHitExpiryGroup, "expiryDate">[], now = new Date()) {
  if (expiries.length === 0) {
    return null;
  }

  const today = now.toISOString().slice(0, 10);
  const upcoming = expiries.find((expiry) => expiry.expiryDate >= today);
  return upcoming?.expiryDate ?? expiries[0]!.expiryDate;
}

export function getDefaultPriceHitEventId(expiries: PriceHitExpiryGroup[], defaultExpiry: string | null) {
  if (!defaultExpiry) {
    return expiries[0]?.events[0]?.eventId ?? null;
  }

  const matchingExpiry = expiries.find((expiry) => expiry.expiryDate === defaultExpiry);
  return matchingExpiry?.events[0]?.eventId ?? expiries[0]?.events[0]?.eventId ?? null;
}
