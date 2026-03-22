import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  AlertSummary,
  ClobTrade,
  InsiderAlert,
  ScanState,
  TradeLedgerRow,
  WalletAlertsResponse,
  WalletStats,
} from "@/lib/insider/types";

const GLOBAL_SCAN_KEY = "global";

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

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function toNullableNumber(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  return toNumber(value, Number.NaN);
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function mapWalletHistoryRow(row: Record<string, unknown>): WalletStats {
  const markets = normalizeStringArray(row.markets);
  const firstSeenAt = typeof row.first_seen_at === "string" ? row.first_seen_at : null;
  const firstSeenMs = firstSeenAt ? new Date(firstSeenAt).getTime() : Number.NaN;
  const nowMs = Date.now();
  const walletAgeHours = Number.isNaN(firstSeenMs) ? null : Math.max(0, nowMs - firstSeenMs) / (60 * 60 * 1_000);
  const totalTrades = toNumber(row.total_trades, 0);
  const totalWins = toNumber(row.total_wins, 0);
  const resolvedTrades = toNumber(row.resolved_trades, 0);

  return {
    wallet: typeof row.wallet === "string" ? row.wallet : "",
    firstSeenAt,
    lastSeenAt: typeof row.last_seen_at === "string" ? row.last_seen_at : null,
    totalTrades,
    totalWins,
    resolvedTrades,
    totalVolume: toNumber(row.total_volume, 0),
    markets,
    consecutiveLarge: toNumber(row.consecutive_large, 0),
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
    marketCount: markets.length,
    walletAgeHours,
    walletWinRate: resolvedTrades > 0 ? totalWins / resolvedTrades : null,
  };
}

function mapAlertRow(row: Record<string, unknown>): InsiderAlert {
  const flags = normalizeStringArray(row.flags) as InsiderAlert["flags"];

  return {
    id: toNumber(row.id, 0),
    detectedAt: typeof row.detected_at === "string" ? row.detected_at : new Date(0).toISOString(),
    tradeId: typeof row.trade_id === "string" ? row.trade_id : "",
    marketId: typeof row.market_id === "string" ? row.market_id : "",
    marketSlug: typeof row.market_slug === "string" ? row.market_slug : null,
    marketTitle: typeof row.market_title === "string" ? row.market_title : "Unknown market",
    wallet: typeof row.wallet === "string" ? row.wallet : "",
    sizeUsdc: toNumber(row.size_usdc, 0),
    price: toNumber(row.price, 0),
    side: row.side === "SELL" ? "SELL" : "BUY",
    score: toNumber(row.score, 0),
    flags,
    walletAgeHours: toNullableNumber(row.wallet_age_h),
    walletWinRate: toNullableNumber(row.wallet_win_rate),
    walletTotalTrades: toNumber(row.wallet_total_trades, 0),
  };
}

function mapTradeLedgerRow(row: Record<string, unknown>): TradeLedgerRow {
  return {
    tradeId: typeof row.trade_id === "string" ? row.trade_id : "",
    marketId: typeof row.market_id === "string" ? row.market_id : "",
    marketSlug: typeof row.market_slug === "string" ? row.market_slug : null,
    marketTitle: typeof row.market_title === "string" ? row.market_title : "Unknown market",
    wallet: typeof row.wallet === "string" ? row.wallet : "",
    tokenId: typeof row.token_id === "string" ? row.token_id : null,
    outcome: typeof row.outcome === "string" ? row.outcome : null,
    side: row.side === "SELL" ? "SELL" : "BUY",
    sizeUsdc: toNumber(row.size_usdc, 0),
    price: toNumber(row.price, 0),
    tradedAt: typeof row.traded_at === "string" ? row.traded_at : new Date(0).toISOString(),
    isLarge: Boolean(row.is_large),
    isWin: typeof row.is_win === "boolean" ? row.is_win : null,
    winApplied: Boolean(row.win_applied),
    raw: row.raw && typeof row.raw === "object" ? (row.raw as Record<string, unknown>) : {},
  };
}

async function countAlerts(
  params: {
    minScore: number;
    marketId: string | null;
  },
  options?: {
    containsFlags?: string[];
    minScoreOverride?: number;
  },
) {
  const client = getSupabaseAdminClient();
  let query = client
    .from("insider_alerts")
    .select("id", {
      count: "exact",
      head: true,
    })
    .gte("score", options?.minScoreOverride ?? params.minScore);

  if (params.marketId) {
    query = query.eq("market_id", params.marketId);
  }

  if (options?.containsFlags) {
    query = query.filter("flags", "cs", JSON.stringify(options.containsFlags));
  }

  const { count, error } = await query;
  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function getWalletHistory(wallet: string) {
  const client = getSupabaseAdminClient();
  const normalizedWallet = wallet.toLowerCase();
  const { data, error } = await client.from("wallet_history").select("*").eq("wallet", normalizedWallet).maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapWalletHistoryRow(data as Record<string, unknown>) : null;
}

export async function upsertWalletHistory(input: {
  wallet: string;
  seenAt: string;
  marketId: string;
  tradeValue: number;
  isLarge: boolean;
  isWin?: boolean;
}) {
  const client = getSupabaseAdminClient();
  const { data, error } = await client.rpc("upsert_wallet_history", {
    p_wallet: input.wallet.toLowerCase(),
    p_seen_at: input.seenAt,
    p_market_id: input.marketId,
    p_trade_value: input.tradeValue,
    p_is_large: input.isLarge,
    p_is_win: input.isWin ?? false,
  });

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  return row ? mapWalletHistoryRow(row as Record<string, unknown>) : null;
}

export async function ingestInsiderTrade(input: {
  trade: ClobTrade;
  marketSlug: string | null;
  marketTitle: string;
  isLarge: boolean;
}) {
  const client = getSupabaseAdminClient();
  const { data, error } = await client.rpc("ingest_insider_trade", {
    p_trade_id: input.trade.tradeId,
    p_market_id: input.trade.marketId,
    p_market_slug: input.marketSlug,
    p_market_title: input.marketTitle,
    p_wallet: input.trade.wallet.toLowerCase(),
    p_token_id: input.trade.tokenId,
    p_outcome: input.trade.outcome,
    p_side: input.trade.side,
    p_size_usdc: input.trade.sizeUsdc,
    p_price: input.trade.price,
    p_traded_at: input.trade.timestamp,
    p_is_large: input.isLarge,
    p_raw: input.trade.raw,
  });

  if (error) {
    throw error;
  }

  return Boolean(data);
}

export async function saveInsiderAlert(alert: Omit<InsiderAlert, "id" | "detectedAt">) {
  const client = getSupabaseAdminClient();
  const { error } = await client.from("insider_alerts").insert({
    trade_id: alert.tradeId,
    market_id: alert.marketId,
    market_slug: alert.marketSlug,
    market_title: alert.marketTitle,
    wallet: alert.wallet.toLowerCase(),
    size_usdc: alert.sizeUsdc,
    price: alert.price,
    side: alert.side,
    score: alert.score,
    flags: alert.flags,
    wallet_age_h: alert.walletAgeHours,
    wallet_win_rate: alert.walletWinRate,
    wallet_total_trades: alert.walletTotalTrades,
  });

  if (error) {
    if (error.code === "23505") {
      return false;
    }

    throw error;
  }

  return true;
}

export async function fetchLastScanState(): Promise<ScanState | null> {
  const client = getSupabaseAdminClient();
  const { data, error } = await client.from("insider_scan_state").select("*").eq("scan_key", GLOBAL_SCAN_KEY).maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    lastScannedAt: typeof data.last_scanned_at === "string" ? data.last_scanned_at : null,
    scannedCount: toNumber(data.scanned_count, 0),
    analyzedCount: toNumber(data.analyzed_count, 0),
    alertsCount: toNumber(data.alerts_count, 0),
  };
}

export async function fetchLatestTradeLedgerTimestamp() {
  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("insider_trade_ledger")
    .select("traded_at")
    .order("traded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return typeof data?.traded_at === "string" ? data.traded_at : null;
}

export async function updateScanState(input: {
  lastScannedAt: string;
  scannedCount: number;
  analyzedCount: number;
  alertsCount: number;
}) {
  const client = getSupabaseAdminClient();
  const { error } = await client.from("insider_scan_state").upsert({
    scan_key: GLOBAL_SCAN_KEY,
    last_scanned_at: input.lastScannedAt,
    scanned_count: input.scannedCount,
    analyzed_count: input.analyzedCount,
    alerts_count: input.alertsCount,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw error;
  }
}

export async function fetchInsiderAlerts(params: {
  minScore: number;
  limit: number;
  marketId: string | null;
}) {
  const client = getSupabaseAdminClient();

  let itemsQuery = client
    .from("insider_alerts")
    .select("*")
    .gte("score", params.minScore)
    .order("score", { ascending: false })
    .order("detected_at", { ascending: false })
    .limit(params.limit);

  if (params.marketId) {
    itemsQuery = itemsQuery.eq("market_id", params.marketId);
  }

  const [{ data, error }, totalAlerts, highScoreAlerts, newWalletAlerts, scanState] = await Promise.all([
    itemsQuery,
    countAlerts(params),
    countAlerts(params, { minScoreOverride: Math.max(params.minScore, 8) }),
    countAlerts(params, { containsFlags: ["new_wallet"] }),
    fetchLastScanState(),
  ]);

  if (error) {
    throw error;
  }

  const summary: AlertSummary = {
    totalAlerts,
    highScoreAlerts,
    newWalletAlerts,
  };

  return {
    params,
    fetchedAt: new Date().toISOString(),
    lastScannedAt: scanState?.lastScannedAt ?? null,
    summary,
    items: (data ?? []).map((row) => mapAlertRow(row as Record<string, unknown>)),
  };
}

export async function fetchWalletAlerts(wallet: string): Promise<WalletAlertsResponse> {
  const client = getSupabaseAdminClient();
  const normalizedWallet = wallet.toLowerCase();

  const [{ data: alertsData, error: alertsError }, stats, scanState] = await Promise.all([
    client
      .from("insider_alerts")
      .select("*")
      .eq("wallet", normalizedWallet)
      .order("detected_at", { ascending: false }),
    getWalletHistory(normalizedWallet),
    fetchLastScanState(),
  ]);

  if (alertsError) {
    throw alertsError;
  }

  return {
    fetchedAt: new Date().toISOString(),
    lastScannedAt: scanState?.lastScannedAt ?? null,
    wallet: normalizedWallet,
    stats,
    alerts: (alertsData ?? []).map((row) => mapAlertRow(row as Record<string, unknown>)),
  };
}

export async function fetchPendingTradeSettlements(limit = 500) {
  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("insider_trade_ledger")
    .select("*")
    .is("is_win", null)
    .order("traded_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapTradeLedgerRow(row as Record<string, unknown>));
}

export async function settleInsiderTrade(tradeId: string, isWin: boolean) {
  const client = getSupabaseAdminClient();
  const { data, error } = await client.rpc("settle_insider_trade", {
    p_trade_id: tradeId,
    p_is_win: isWin,
    p_settled_at: new Date().toISOString(),
  });

  if (error) {
    throw error;
  }

  return Boolean(data);
}
