import { z } from "zod";

import { gammaPublicSearchResponseSchema } from "@/lib/polymarket/schemas";
import { ItemStatus, WatchlistEventItem, WatchlistMarketItem } from "@/lib/polymarket/types";

type SearchResponse = z.infer<typeof gammaPublicSearchResponseSchema>;
type SearchEvent = NonNullable<SearchResponse["events"]>[number];
type SearchMarket = NonNullable<SearchEvent["markets"]>[number];

type SearchMarketCandidate = {
  item: WatchlistMarketItem;
  marketRank: number;
  relevanceScore: number | null;
};

type SearchEventCandidate = {
  item: WatchlistEventItem;
  eventRank: number;
  relevanceScore: number | null;
};

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
    return Array.isArray(parsed)
      ? parsed
          .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
          .filter((entry) => entry.length > 0)
      : [];
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
    return Array.isArray(parsed) ? parsed.map((entry) => toNumber(entry)).filter((entry): entry is number => entry !== null) : [];
  } catch {
    return [];
  }
}

function normalizeTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function inferStatus(raw: { active?: unknown; closed?: unknown; resolved?: unknown }): ItemStatus {
  if (toBoolean(raw.closed)) {
    return "closed";
  }

  if (toBoolean(raw.resolved)) {
    return "resolved";
  }

  if (toBoolean(raw.active)) {
    return "active";
  }

  return "unknown";
}

function toPolymarketUrl(kind: "market" | "event", slug: unknown): string | null {
  const normalizedSlug = toString(slug);
  return normalizedSlug ? `https://polymarket.com/${kind}/${normalizedSlug}` : null;
}

function normalizeBinaryPrices(rawMarket: SearchMarket) {
  const prices = parseOutcomePrices(rawMarket.outcomePrices);
  const labels = parseStringArray(rawMarket.outcomes).map((label) => label.toLowerCase());

  if (prices.length === 0) {
    return {
      yesPrice: null,
      noPrice: null,
    };
  }

  if (labels.length === prices.length) {
    const yesIndex = labels.findIndex((label) => label === "yes");
    const noIndex = labels.findIndex((label) => label === "no");

    if (yesIndex >= 0 || noIndex >= 0) {
      return {
        yesPrice: yesIndex >= 0 ? prices[yesIndex] ?? null : null,
        noPrice: noIndex >= 0 ? prices[noIndex] ?? null : null,
      };
    }
  }

  return {
    yesPrice: prices[0] ?? null,
    noPrice: prices[1] ?? null,
  };
}

function normalizeWatchlistMarket(rawMarket: SearchMarket): WatchlistMarketItem {
  const { yesPrice, noPrice } = normalizeBinaryPrices(rawMarket);
  const directLastTradePrice = toNumber(rawMarket.lastTradePrice);

  return {
    id: toString(rawMarket.id) ?? toString(rawMarket.slug) ?? toString(rawMarket.question) ?? "unknown-market",
    title: toString(rawMarket.question) ?? toString(rawMarket.title) ?? "Untitled market",
    yesPrice,
    noPrice,
    lastTradePrice: directLastTradePrice ?? yesPrice,
    volume24hUsd: toNumber(rawMarket.volume24hr),
    volumeTotalUsd: toNumber(rawMarket.volumeNum) ?? toNumber(rawMarket.volume),
    url: toPolymarketUrl("market", rawMarket.slug),
    status: inferStatus(rawMarket),
    updatedAt: normalizeTimestamp(rawMarket.updatedAt),
  };
}

function isActiveSearchMarket(rawMarket: SearchMarket) {
  return Boolean(toBoolean(rawMarket.active)) && !toBoolean(rawMarket.closed) && !toBoolean(rawMarket.resolved);
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

function compareMarketCandidates(a: SearchMarketCandidate, b: SearchMarketCandidate) {
  const scoreComparison = compareNullableNumberDesc(a.relevanceScore, b.relevanceScore);
  if (scoreComparison !== 0) {
    return scoreComparison;
  }

  const volumeComparison = compareNullableNumberDesc(a.item.volumeTotalUsd ?? a.item.volume24hUsd, b.item.volumeTotalUsd ?? b.item.volume24hUsd);
  if (volumeComparison !== 0) {
    return volumeComparison;
  }

  if (a.marketRank !== b.marketRank) {
    return a.marketRank - b.marketRank;
  }

  return a.item.title.localeCompare(b.item.title);
}

function latestTimestamp(timestamps: Array<string | null>) {
  const normalized = timestamps.filter((timestamp): timestamp is string => Boolean(timestamp));

  if (normalized.length === 0) {
    return null;
  }

  return normalized.reduce((latest, value) => {
    return new Date(value).getTime() > new Date(latest).getTime() ? value : latest;
  });
}

function sumValues(values: Array<number | null>) {
  const numericValues = values.filter((value): value is number => value !== null);
  if (numericValues.length === 0) {
    return null;
  }

  return numericValues.reduce((total, value) => total + value, 0);
}

function normalizeEventMarkets(rawEvent: SearchEvent) {
  const markets = rawEvent.markets ?? [];
  const eventScore = toNumber(rawEvent.score);
  const bestById = new Map<string, SearchMarketCandidate>();

  for (const [marketRank, market] of markets.entries()) {
    if (!isActiveSearchMarket(market)) {
      continue;
    }

    const candidate: SearchMarketCandidate = {
      item: normalizeWatchlistMarket(market),
      marketRank,
      relevanceScore: toNumber(market.score) ?? eventScore,
    };

    const current = bestById.get(candidate.item.id);
    if (!current || compareMarketCandidates(candidate, current) < 0) {
      bestById.set(candidate.item.id, candidate);
    }
  }

  return Array.from(bestById.values()).sort(compareMarketCandidates);
}

function normalizeWatchlistEvent(rawEvent: SearchEvent, eventRank: number): SearchEventCandidate | null {
  const marketCandidates = normalizeEventMarkets(rawEvent);

  if (marketCandidates.length === 0) {
    return null;
  }

  const markets = marketCandidates.map((candidate) => candidate.item);
  const fallbackStatus = inferStatus(rawEvent);

  const item: WatchlistEventItem = {
    id: toString(rawEvent.id) ?? toString(rawEvent.slug) ?? toString(rawEvent.title) ?? `event-${eventRank}`,
    title: toString(rawEvent.title) ?? markets[0]?.title ?? "Untitled event",
    url: toPolymarketUrl("event", rawEvent.slug),
    status: fallbackStatus === "unknown" ? "active" : fallbackStatus,
    volume24hUsd: toNumber(rawEvent.volume24hr) ?? sumValues(markets.map((market) => market.volume24hUsd)),
    volumeTotalUsd: toNumber(rawEvent.volume) ?? sumValues(markets.map((market) => market.volumeTotalUsd)),
    marketCount: markets.length,
    updatedAt: normalizeTimestamp(rawEvent.updatedAt) ?? latestTimestamp(markets.map((market) => market.updatedAt)),
    markets,
  };

  return {
    item,
    eventRank,
    relevanceScore:
      toNumber(rawEvent.score) ??
      marketCandidates.reduce<number | null>((currentBest, candidate) => {
        if (candidate.relevanceScore === null) {
          return currentBest;
        }

        if (currentBest === null || candidate.relevanceScore > currentBest) {
          return candidate.relevanceScore;
        }

        return currentBest;
      }, null),
  };
}

function compareEventCandidates(a: SearchEventCandidate, b: SearchEventCandidate) {
  const scoreComparison = compareNullableNumberDesc(a.relevanceScore, b.relevanceScore);
  if (scoreComparison !== 0) {
    return scoreComparison;
  }

  const volumeComparison = compareNullableNumberDesc(a.item.volumeTotalUsd ?? a.item.volume24hUsd, b.item.volumeTotalUsd ?? b.item.volume24hUsd);
  if (volumeComparison !== 0) {
    return volumeComparison;
  }

  if (a.item.marketCount !== b.item.marketCount) {
    return b.item.marketCount - a.item.marketCount;
  }

  if (a.eventRank !== b.eventRank) {
    return a.eventRank - b.eventRank;
  }

  return a.item.title.localeCompare(b.item.title);
}

export function normalizeWatchlistEvents(rawSearchResponse: unknown): WatchlistEventItem[] {
  const searchResponse = gammaPublicSearchResponseSchema.parse(rawSearchResponse);
  const eventCandidates = (searchResponse.events ?? [])
    .map((event, eventRank) => normalizeWatchlistEvent(event, eventRank))
    .filter((candidate): candidate is SearchEventCandidate => candidate !== null)
    .sort(compareEventCandidates);

  const seenMarketIds = new Set<string>();
  const normalizedEvents: WatchlistEventItem[] = [];

  for (const candidate of eventCandidates) {
    const uniqueMarkets = candidate.item.markets.filter((market) => {
      if (seenMarketIds.has(market.id)) {
        return false;
      }

      seenMarketIds.add(market.id);
      return true;
    });

    if (uniqueMarkets.length === 0) {
      continue;
    }

    normalizedEvents.push({
      ...candidate.item,
      marketCount: uniqueMarkets.length,
      volume24hUsd: sumValues(uniqueMarkets.map((market) => market.volume24hUsd)) ?? candidate.item.volume24hUsd,
      volumeTotalUsd: sumValues(uniqueMarkets.map((market) => market.volumeTotalUsd)) ?? candidate.item.volumeTotalUsd,
      updatedAt: latestTimestamp(uniqueMarkets.map((market) => market.updatedAt)) ?? candidate.item.updatedAt,
      markets: uniqueMarkets,
    });
  }

  return normalizedEvents;
}
