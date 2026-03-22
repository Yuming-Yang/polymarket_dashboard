import "server-only";

import { getPriceHitAssetConfig, PRICE_HIT_ASSETS, type PriceHitAssetConfig } from "@/lib/price-hit/assets";
import { classifyPriceHitEvents } from "@/lib/price-hit/classifier";
import { getPriceHitCache, isPriceHitCacheExpired, type PriceHitCacheEntry, upsertPriceHitCache } from "@/lib/price-hit/cache";
import { fetchEventById } from "@/lib/polymarket/client";
import { gammaEventSchema } from "@/lib/polymarket/schemas";
import { buildPriceHitExpiryDistributions, getDefaultPriceHitExpiry, normalizePriceHitMarketsForEvent } from "@/lib/polymarket/price-hit";
import { PriceHitAiCacheStatus, PriceHitAssetKey, PriceHitRefreshAssetResult, PriceHitRefreshResponse, PriceHitResponse } from "@/lib/polymarket/types";

const PRICE_FETCH_CONCURRENCY = 3;
const REFRESH_CONCURRENCY = 2;

type CacheResolution = {
  entry: PriceHitCacheEntry;
  status: PriceHitAiCacheStatus;
};

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

async function mapWithConcurrency<T, TResult>(items: T[], concurrency: number, fn: (item: T) => Promise<TResult>) {
  const results = new Array<TResult>(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await fn(items[currentIndex]!);
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, () => worker()));
  return results;
}

async function refreshPriceHitAssetCache(asset: PriceHitAssetConfig, force: boolean): Promise<CacheResolution> {
  const cached = await getPriceHitCache(asset.key);
  const shouldRefresh = force || !cached || isPriceHitCacheExpired(cached);

  if (!shouldRefresh) {
    return {
      entry: cached,
      status: "cache_hit",
    };
  }

  try {
    const classifiedEvents = await classifyPriceHitEvents(asset);
    const entry = await upsertPriceHitCache({
      asset: asset.key,
      searchQuery: asset.searchQuery,
      events: classifiedEvents,
    });

    return {
      entry,
      status: "refreshed",
    };
  } catch (error) {
    if (cached) {
      console.error("[price-hit/service] classification refresh failed, using stale cache", {
        asset: asset.key,
        error: toErrorMessage(error),
      });

      return {
        entry: cached,
        status: "stale_fallback",
      };
    }

    throw error;
  }
}

async function fetchLiveStructuredEvents(
  events: PriceHitCacheEntry["events"],
) {
  return mapWithConcurrency(events, PRICE_FETCH_CONCURRENCY, async (event) => {
    try {
      const rawEvent = await fetchEventById({
        eventId: event.eventId,
        noStore: true,
      });

      return {
        structuredEvent: event,
        rawEvent: gammaEventSchema.parse(rawEvent),
      };
    } catch (error) {
      console.error("[price-hit/service] failed to fetch live event detail", {
        eventId: event.eventId,
        asset: event.asset,
        error: toErrorMessage(error),
      });

      return null;
    }
  });
}

function buildRefreshResult(
  asset: PriceHitAssetConfig,
  result: CacheResolution | null,
  error: unknown,
): PriceHitRefreshAssetResult {
  if (!result?.entry) {
    return {
      asset: asset.key,
      assetLabel: asset.label,
      ok: false,
      status: "failed",
      structuredEventCount: 0,
      refreshedAt: null,
      expiresAt: null,
      message: toErrorMessage(error),
    };
  }

  return {
    asset: asset.key,
    assetLabel: asset.label,
    ok: true,
    status: result.status === "stale_fallback" ? "stale_fallback" : "refreshed",
    structuredEventCount: result.entry.events.length,
    refreshedAt: result.entry.refreshedAt,
    expiresAt: result.entry.expiresAt,
    message: result.status === "stale_fallback" ? "Classification refresh failed; using the previous cached result." : null,
  };
}

export async function getPriceHitData(assetKey: PriceHitAssetKey): Promise<PriceHitResponse> {
  const asset = getPriceHitAssetConfig(assetKey);
  const cacheResolution = await refreshPriceHitAssetCache(asset, false);
  const structuredEvents = cacheResolution.entry?.events ?? [];

  if (structuredEvents.length === 0) {
    return {
      asset: asset.key,
      assetLabel: asset.label,
      assetName: asset.name,
      fetchedAt: new Date().toISOString(),
      aiCacheStatus: cacheResolution.status,
      aiRefreshedAt: cacheResolution.entry?.refreshedAt ?? null,
      aiExpiresAt: cacheResolution.entry?.expiresAt ?? null,
      structuredEventCount: 0,
      defaultExpiry: null,
      expiries: [],
    };
  }

  const liveEvents = (await fetchLiveStructuredEvents(structuredEvents)).filter(
    (event): event is NonNullable<typeof event> => event !== null,
  );

  if (liveEvents.length === 0) {
    throw new Error("Failed to fetch live price-hit market data.");
  }

  const markets = liveEvents.flatMap(({ rawEvent, structuredEvent }) => normalizePriceHitMarketsForEvent(rawEvent, structuredEvent));
  const expiries = buildPriceHitExpiryDistributions(markets);

  return {
    asset: asset.key,
    assetLabel: asset.label,
    assetName: asset.name,
    fetchedAt: new Date().toISOString(),
    aiCacheStatus: cacheResolution.status,
    aiRefreshedAt: cacheResolution.entry?.refreshedAt ?? null,
    aiExpiresAt: cacheResolution.entry?.expiresAt ?? null,
    structuredEventCount: structuredEvents.length,
    defaultExpiry: getDefaultPriceHitExpiry(expiries),
    expiries,
  };
}

export async function refreshAllPriceHitAssets(): Promise<PriceHitRefreshResponse> {
  const results = await mapWithConcurrency(PRICE_HIT_ASSETS, REFRESH_CONCURRENCY, async (asset) => {
    try {
      const result = await refreshPriceHitAssetCache(asset, true);
      return buildRefreshResult(asset, result, null);
    } catch (error) {
      const cached = await getPriceHitCache(asset.key);
      return buildRefreshResult(
        asset,
        cached
          ? {
              entry: cached,
              status: "stale_fallback",
            }
          : null,
        error,
      );
    }
  });

  return {
    fetchedAt: new Date().toISOString(),
    ok: results.every((result) => result.ok),
    results,
  };
}
