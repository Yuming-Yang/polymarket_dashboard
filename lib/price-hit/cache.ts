import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { PRICE_HIT_CACHE_TTL_MS } from "@/lib/price-hit/assets";
import { priceHitStructuredEventSchema } from "@/lib/polymarket/schemas";
import { PriceHitAssetKey, PriceHitStructuredEvent } from "@/lib/polymarket/types";

const CACHE_TABLE = "price_hit_event_cache";
const structuredEventsSchema = z.array(priceHitStructuredEventSchema);

export type PriceHitCacheEntry = {
  asset: PriceHitAssetKey;
  searchQuery: string;
  events: PriceHitStructuredEvent[];
  refreshedAt: string;
  expiresAt: string;
};

let supabaseAdminClient: SupabaseClient | null = null;

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getSupabaseAdminClient() {
  if (!supabaseAdminClient) {
    supabaseAdminClient = createClient(getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"), getRequiredEnv("SUPABASE_SERVICE_KEY"), {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return supabaseAdminClient;
}

function toString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function mapCacheRow(row: Record<string, unknown>): PriceHitCacheEntry {
  return {
    asset: priceHitStructuredEventSchema.shape.asset.parse(row.asset),
    searchQuery: toString(row.search_query),
    events: structuredEventsSchema.parse(row.events ?? []),
    refreshedAt: toString(row.refreshed_at),
    expiresAt: toString(row.expires_at),
  };
}

export function isPriceHitCacheExpired(entry: Pick<PriceHitCacheEntry, "expiresAt">, now = Date.now()) {
  const expiresMs = new Date(entry.expiresAt).getTime();
  return Number.isNaN(expiresMs) || expiresMs <= now;
}

export async function getPriceHitCache(asset: PriceHitAssetKey) {
  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from(CACHE_TABLE)
    .select("asset, search_query, events, refreshed_at, expires_at")
    .eq("asset", asset)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapCacheRow(data as Record<string, unknown>) : null;
}

export async function upsertPriceHitCache(params: {
  asset: PriceHitAssetKey;
  searchQuery: string;
  events: PriceHitStructuredEvent[];
  now?: number;
}) {
  const client = getSupabaseAdminClient();
  const now = new Date(params.now ?? Date.now());
  const expiresAt = new Date(now.getTime() + PRICE_HIT_CACHE_TTL_MS);

  const { data, error } = await client
    .from(CACHE_TABLE)
    .upsert(
      {
        asset: params.asset,
        search_query: params.searchQuery,
        events: params.events,
        refreshed_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        onConflict: "asset",
      },
    )
    .select("asset, search_query, events, refreshed_at, expires_at")
    .single();

  if (error) {
    throw error;
  }

  return mapCacheRow(data as Record<string, unknown>);
}
