import { z } from "zod";

import { gammaPublicSearchResponseSchema } from "@/lib/polymarket/schemas";
import { ItemStatus, WatchlistMarketItem } from "@/lib/polymarket/types";

type SearchResponse = z.infer<typeof gammaPublicSearchResponseSchema>;
type SearchEvent = NonNullable<SearchResponse["events"]>[number];
type SearchMarket = NonNullable<SearchEvent["markets"]>[number];

type SearchCandidate = {
  item: WatchlistMarketItem;
  eventRank: number;
  marketRank: number;
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

function inferStatus(rawMarket: { active?: unknown; closed?: unknown; resolved?: unknown }): ItemStatus {
  if (toBoolean(rawMarket.closed)) {
    return "closed";
  }

  if (toBoolean(rawMarket.resolved)) {
    return "resolved";
  }

  if (toBoolean(rawMarket.active)) {
    return "active";
  }

  return "unknown";
}

function toPolymarketUrl(slug: unknown): string | null {
  const normalizedSlug = toString(slug);
  return normalizedSlug ? `https://polymarket.com/market/${normalizedSlug}` : null;
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
    url: toPolymarketUrl(rawMarket.slug),
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

function compareCandidates(a: SearchCandidate, b: SearchCandidate) {
  const scoreComparison = compareNullableNumberDesc(a.relevanceScore, b.relevanceScore);
  if (scoreComparison !== 0) {
    return scoreComparison;
  }

  if (a.eventRank !== b.eventRank) {
    return a.eventRank - b.eventRank;
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

function flattenCandidates(searchResponse: SearchResponse): SearchCandidate[] {
  const events = searchResponse.events ?? [];

  return events.flatMap((event, eventRank) => {
    const markets = event.markets ?? [];
    const eventScore = toNumber(event.score);

    return markets
      .filter((market) => isActiveSearchMarket(market))
      .map((market, marketRank) => ({
        item: normalizeWatchlistMarket(market),
        eventRank,
        marketRank,
        relevanceScore: toNumber(market.score) ?? eventScore,
      }));
  });
}

export function normalizeWatchlistMarkets(rawSearchResponse: unknown): WatchlistMarketItem[] {
  const searchResponse = gammaPublicSearchResponseSchema.parse(rawSearchResponse);
  const candidates = flattenCandidates(searchResponse);
  const bestById = new Map<string, SearchCandidate>();

  for (const candidate of candidates) {
    const current = bestById.get(candidate.item.id);

    if (!current || compareCandidates(candidate, current) < 0) {
      bestById.set(candidate.item.id, candidate);
    }
  }

  return Array.from(bestById.values())
    .sort(compareCandidates)
    .map((candidate) => candidate.item);
}
