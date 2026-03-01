import { GammaEventRaw, GammaMarketRaw, ItemStatus, TopVolumeItem } from "@/lib/polymarket/types";

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

  if (typeof value === "string") {
    const lowered = value.trim().toLowerCase();
    if (lowered === "true") {
      return true;
    }

    if (lowered === "false") {
      return false;
    }
  }

  if (typeof value === "number") {
    if (value === 1) {
      return true;
    }

    if (value === 0) {
      return false;
    }
  }

  return null;
}

function toTags(rawTags: unknown): string[] {
  if (!Array.isArray(rawTags)) {
    return [];
  }

  return rawTags
    .map((tag) => {
      if (!tag || typeof tag !== "object") {
        return null;
      }

      const label = (tag as { label?: unknown }).label;
      return typeof label === "string" && label.trim().length > 0 ? label.trim() : null;
    })
    .filter((tag): tag is string => Boolean(tag));
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

function inferStatus(raw: { active?: unknown; resolved?: unknown; closed?: unknown }): ItemStatus {
  const closed = toBoolean(raw.closed);
  const resolved = toBoolean(raw.resolved);
  const active = toBoolean(raw.active);

  if (closed) {
    return "closed";
  }

  if (resolved) {
    return "resolved";
  }

  if (active) {
    return "active";
  }

  return "unknown";
}

function toPolymarketUrl(slug: unknown): string | null {
  if (typeof slug !== "string" || slug.trim().length === 0) {
    return null;
  }

  return `https://polymarket.com/event/${slug.trim()}`;
}

function normalizeTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeMarketPrice(rawMarket: GammaMarketRaw): number | null {
  const directPrice = toNumber(rawMarket.lastTradePrice);
  if (directPrice !== null) {
    return directPrice;
  }

  const prices = parseOutcomePrices(rawMarket.outcomePrices);
  return prices.length > 0 ? prices[0] : null;
}

function stableId(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return fallback;
}

export function normalizeMarket(rawMarket: GammaMarketRaw, index: number): TopVolumeItem {
  const volumeTotal = toNumber(rawMarket.volume) ?? toNumber(rawMarket.volumeNum);

  return {
    kind: "market",
    id: stableId(rawMarket.id, `market-${index}`),
    title: rawMarket.question?.trim() || rawMarket.title?.trim() || "Untitled market",
    status: inferStatus(rawMarket),
    volume24hUsd: toNumber(rawMarket.volume24hr),
    volumeTotalUsd: volumeTotal,
    displayVolumeUsd: null,
    price: normalizeMarketPrice(rawMarket),
    url: toPolymarketUrl(rawMarket.slug),
    tags: toTags(rawMarket.tags),
    updatedAt: normalizeTimestamp(rawMarket.updatedAt),
  };
}

export function normalizeEvent(rawEvent: GammaEventRaw, index: number): TopVolumeItem {
  return {
    kind: "event",
    id: stableId(rawEvent.id, `event-${index}`),
    title: rawEvent.title?.trim() || "Untitled event",
    status: inferStatus(rawEvent),
    volume24hUsd: toNumber(rawEvent.volume24hr),
    volumeTotalUsd: toNumber(rawEvent.volume),
    displayVolumeUsd: null,
    price: null,
    url: toPolymarketUrl(rawEvent.slug),
    tags: toTags(rawEvent.tags),
    updatedAt: normalizeTimestamp(rawEvent.updatedAt),
  };
}

export function normalizeMarkets(rawMarkets: GammaMarketRaw[]): TopVolumeItem[] {
  return rawMarkets.map((market, index) => normalizeMarket(market, index));
}

export function normalizeEvents(rawEvents: GammaEventRaw[]): TopVolumeItem[] {
  return rawEvents.map((event, index) => normalizeEvent(event, index));
}
