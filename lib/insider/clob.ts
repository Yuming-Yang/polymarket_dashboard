import "server-only";

import { ClobTrade, InsiderTradeSide, MarketDetail, MarketToken, TradeLedgerRow } from "@/lib/insider/types";

const TRADES_BASE_URL = process.env.POLYMARKET_DATA_API_BASE_URL ?? "https://data-api.polymarket.com";
const GAMMA_BASE_URL = process.env.POLYMARKET_GAMMA_BASE_URL ?? "https://gamma-api.polymarket.com";
const REQUEST_TIMEOUT_MS = 12_000;
const MAX_RETRIES = 1;
const DEFAULT_MINIMUM_TRACKED_TRADE_USDC = 500;
const MAX_TRADE_PAGE_LIMIT = 100;
const DEFAULT_SCAN_OVERLAP_MS = 5 * 60 * 1_000;

export class InsiderUpstreamError extends Error {
  upstreamStatus: number;

  constructor(message: string, upstreamStatus: number) {
    super(message);
    this.name = "InsiderUpstreamError";
    this.upstreamStatus = upstreamStatus;
  }
}

function isRetriableStatus(status: number) {
  return status >= 500 && status < 600;
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toString(value: unknown) {
  if (typeof value === "string" && value.trim() !== "") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function toBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") {
      return true;
    }

    if (normalized === "false" || normalized === "0") {
      return false;
    }
  }

  return null;
}

function parseJsonArray(value: unknown) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

function normalizeTimestamp(value: unknown) {
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return {
        iso: parsed.toISOString(),
        ms: parsed.getTime(),
      };
    }
  }

  const numeric = toNumber(value);
  if (numeric === null) {
    return null;
  }

  const ms = numeric > 1_000_000_000_000 ? numeric : numeric * 1_000;
  const parsed = new Date(ms);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return {
    iso: parsed.toISOString(),
    ms,
  };
}

export function normalizeMakerAmountToUsdc(value: unknown) {
  const numeric = toNumber(value);
  if (numeric === null) {
    return null;
  }

  if (Math.abs(numeric) >= 1_000_000 || (Number.isInteger(numeric) && Math.abs(numeric) >= 100_000)) {
    return numeric / 1_000_000;
  }

  return numeric;
}

export function normalizeShareSize(value: unknown) {
  const numeric = toNumber(value);
  if (numeric === null) {
    return null;
  }

  if (Math.abs(numeric) >= 1_000_000 || (Number.isInteger(numeric) && Math.abs(numeric) >= 100_000)) {
    return numeric / 1_000_000;
  }

  return numeric;
}

function normalizeSide(value: unknown): InsiderTradeSide | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  if (normalized === "BUY" || normalized === "SELL") {
    return normalized;
  }

  return null;
}

function buildSyntheticTradeId(record: Record<string, unknown>) {
  const transactionHash = toString(record.transaction_hash ?? record.transactionHash ?? record.hash);
  if (!transactionHash) {
    return null;
  }

  const components = [
    transactionHash,
    toString(record.market ?? record.condition_id ?? record.conditionId) ?? "market",
    toString(record.asset_id ?? record.assetId ?? record.token_id ?? record.tokenId ?? record.asset) ?? "asset",
    toString(record.proxyWallet ?? record.maker ?? record.maker_address ?? record.owner) ?? "wallet",
    toString(record.side) ?? "side",
    toString(record.timestamp ?? record.created_at ?? record.createdAt ?? record.matchtime ?? record.matchTime) ?? "time",
    toString(record.size ?? record.makerAmount ?? record.maker_amount) ?? "size",
  ];

  return components.join(":");
}

async function requestJson(url: URL, cache: RequestCache = "no-store"): Promise<unknown> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        cache,
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = new InsiderUpstreamError(`Upstream request failed with status ${response.status}`, response.status);

        if (response.status === 429 || !isRetriableStatus(response.status) || attempt === MAX_RETRIES) {
          throw error;
        }

        lastError = error;
        continue;
      }

      return await response.json();
    } catch (error) {
      const isAbortError = error instanceof Error && error.name === "AbortError";
      const isRetryableNetworkError = error instanceof TypeError || isAbortError;

      if (error instanceof InsiderUpstreamError && (error.upstreamStatus === 429 || !isRetriableStatus(error.upstreamStatus))) {
        throw error;
      }

      if (attempt === MAX_RETRIES || !isRetryableNetworkError) {
        throw error;
      }

      lastError = error as Error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError ?? new Error("Request failed after retries");
}

function normalizeToken(raw: unknown): MarketToken | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const token = raw as Record<string, unknown>;
  return {
    tokenId: toString(token.token_id ?? token.tokenId ?? token.id),
    outcome: toString(token.outcome ?? token.label),
    winner: toBoolean(token.winner) ?? false,
  };
}

export function normalizeMarketDetail(raw: unknown, fallbackId: string): MarketDetail {
  const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const parsedTokens = Array.isArray(record.tokens) ? record.tokens.map(normalizeToken).filter(Boolean) : [];
  const tokens = parsedTokens as MarketToken[];

  if (tokens.length === 0) {
    const tokenIds = parseJsonArray(record.clobTokenIds ?? record.clobTokenIDS);
    const outcomes = parseJsonArray(record.outcomes);
    const winnerOutcome = toString(record.winner);

    for (let index = 0; index < Math.max(tokenIds.length, outcomes.length); index += 1) {
      const tokenId = toString(tokenIds[index] ?? null);
      const outcome = toString(outcomes[index] ?? null);
      tokens.push({
        tokenId,
        outcome,
        winner: outcome !== null && winnerOutcome !== null ? outcome.toLowerCase() === winnerOutcome.toLowerCase() : false,
      });
    }
  }

  return {
    id: toString(record.id) ?? fallbackId,
    slug: toString(record.slug),
    title: toString(record.question ?? record.title) ?? "Unknown market",
    volume24h: toNumber(record.volume24hr ?? record.volume24Hr ?? record.volume24h),
    resolved: toBoolean(record.resolved) ?? false,
    closed: toBoolean(record.closed) ?? false,
    tokens,
  };
}

export function normalizeClobTrade(raw: unknown, options: { minimumSizeUsdc?: number } = {}): ClobTrade | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const minimumSizeUsdc = options.minimumSizeUsdc ?? DEFAULT_MINIMUM_TRACKED_TRADE_USDC;
  const record = raw as Record<string, unknown>;
  const tradeId = toString(record.id) ?? buildSyntheticTradeId(record);
  const marketId = toString(record.market ?? record.condition_id ?? record.conditionId);
  const wallet =
    toString(record.proxyWallet ?? record.proxy_wallet ?? record.maker ?? record.maker_address ?? record.owner)?.toLowerCase() ??
    null;
  const side = normalizeSide(record.side);
  const price = toNumber(record.price);
  const shareSize = normalizeShareSize(record.size);
  const makerAmount = normalizeMakerAmountToUsdc(
    record.makerAmount ?? record.maker_amount ?? record.cashAmount ?? record.cash_amount ?? record.usdcAmount ?? record.usdc_amount,
  );
  const derivedTradeValue = shareSize !== null && price !== null ? shareSize * price : null;
  const sizeUsdc = makerAmount ?? derivedTradeValue;
  const timestamp = normalizeTimestamp(record.timestamp ?? record.created_at ?? record.createdAt ?? record.matchtime ?? record.matchTime);

  if (!tradeId || !marketId || !wallet || !side || price === null || sizeUsdc === null || sizeUsdc <= 0 || !timestamp || sizeUsdc < minimumSizeUsdc) {
    return null;
  }

  return {
    tradeId,
    marketId,
    marketSlug: toString(record.market_slug ?? record.slug ?? record.eventSlug ?? record.event_slug),
    marketTitle: toString(record.market_title ?? record.question ?? record.title),
    wallet,
    tokenId: toString(record.asset_id ?? record.assetId ?? record.token_id ?? record.tokenId ?? record.asset),
    outcome: toString(record.outcome ?? record.outcome_label ?? record.token_outcome),
    side,
    price,
    sizeUsdc,
    shareSize,
    timestamp: timestamp.iso,
    timestampMs: timestamp.ms,
    raw: record,
  };
}

function extractRawTrades(json: unknown) {
  if (Array.isArray(json)) {
    return json;
  }

  if (json && typeof json === "object" && Array.isArray((json as { data?: unknown[] }).data)) {
    return (json as { data: unknown[] }).data;
  }

  return [];
}

function dedupeTrades(trades: ClobTrade[]) {
  const seenTradeIds = new Set<string>();
  const uniqueTrades: ClobTrade[] = [];

  for (const trade of trades) {
    if (seenTradeIds.has(trade.tradeId)) {
      continue;
    }

    seenTradeIds.add(trade.tradeId);
    uniqueTrades.push(trade);
  }

  return uniqueTrades;
}

export async function fetchRecentTrades(params: {
  limit?: number;
  offset?: number;
  marketId?: string;
  takerOnly?: boolean;
  filterType?: string;
  filterAmount?: number;
  minimumSizeUsdc?: number;
} = {}) {
  const url = new URL("/trades", TRADES_BASE_URL);
  const limit = Math.min(MAX_TRADE_PAGE_LIMIT, Math.max(1, params.limit ?? MAX_TRADE_PAGE_LIMIT));
  const offset = Math.max(0, Math.trunc(params.offset ?? 0));
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("takerOnly", String(params.takerOnly ?? false));

  if (params.marketId) {
    url.searchParams.set("market", params.marketId);
  }

  if (params.filterType) {
    url.searchParams.set("filterType", params.filterType);
  }

  if (typeof params.filterAmount === "number" && Number.isFinite(params.filterAmount) && params.filterAmount > 0) {
    url.searchParams.set("filterAmount", String(params.filterAmount));
  }

  const json = await requestJson(url);
  const rawTrades = extractRawTrades(json);

  return rawTrades
    .map((trade) => normalizeClobTrade(trade, { minimumSizeUsdc: params.minimumSizeUsdc }))
    .filter((trade): trade is ClobTrade => trade !== null);
}

export async function fetchTradesForScan(params: {
  afterTimestampMs?: number | null;
  overlapMs?: number;
  limit?: number;
  maxPages?: number;
} = {}) {
  const limit = Math.min(MAX_TRADE_PAGE_LIMIT, Math.max(1, params.limit ?? MAX_TRADE_PAGE_LIMIT));
  const maxPages = Math.min(50, Math.max(1, params.maxPages ?? 20));
  const overlapMs = Math.max(0, params.overlapMs ?? DEFAULT_SCAN_OVERLAP_MS);
  const cutoffMs =
    typeof params.afterTimestampMs === "number" && Number.isFinite(params.afterTimestampMs)
      ? Math.max(0, params.afterTimestampMs - overlapMs)
      : null;
  const collectedTrades: ClobTrade[] = [];

  for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
    const pageTrades = await fetchRecentTrades({
      limit,
      offset: pageIndex * limit,
      takerOnly: false,
      filterType: "CASH",
      filterAmount: DEFAULT_MINIMUM_TRACKED_TRADE_USDC,
      minimumSizeUsdc: DEFAULT_MINIMUM_TRACKED_TRADE_USDC,
    });

    if (pageTrades.length === 0) {
      break;
    }

    for (const trade of pageTrades) {
      if (cutoffMs === null || trade.timestampMs > cutoffMs) {
        collectedTrades.push(trade);
      }
    }

    if (cutoffMs !== null) {
      const oldestTimestampMs = pageTrades.reduce((minimum, trade) => Math.min(minimum, trade.timestampMs), Number.POSITIVE_INFINITY);
      if (oldestTimestampMs <= cutoffMs) {
        break;
      }
    }
  }

  return dedupeTrades(collectedTrades).sort((left, right) => left.timestampMs - right.timestampMs);
}

export async function fetchMarketTrades(params: { marketId: string; limit?: number }) {
  return fetchRecentTrades({
    marketId: params.marketId,
    limit: params.limit ?? MAX_TRADE_PAGE_LIMIT,
    takerOnly: false,
    minimumSizeUsdc: 0,
  });
}

export async function fetchMarketAverageTradeSize(marketId: string, limit = MAX_TRADE_PAGE_LIMIT) {
  const trades = await fetchMarketTrades({ marketId, limit });
  if (trades.length === 0) {
    return null;
  }

  const totalSizeUsdc = trades.reduce((sum, trade) => sum + trade.sizeUsdc, 0);
  return totalSizeUsdc / trades.length;
}

export async function fetchMarketDetail(marketId: string) {
  const url = new URL(`/markets/${marketId}`, GAMMA_BASE_URL);
  const json = await requestJson(url, "force-cache");
  return normalizeMarketDetail(json, marketId);
}

export async function fetchMarketVolume(marketId: string) {
  const market = await fetchMarketDetail(marketId);
  return market.volume24h;
}

function normalizeComparable(value: string | null) {
  return value?.trim().toLowerCase() ?? null;
}

export function classifyResolvedTradeOutcome(
  trade: Pick<TradeLedgerRow, "tokenId" | "outcome" | "side">,
  market: MarketDetail,
) {
  const winningToken = market.tokens.find((token) => token.winner);
  if (!winningToken) {
    return null;
  }

  let tokenIsWinner: boolean | null = null;

  if (trade.tokenId && winningToken.tokenId) {
    tokenIsWinner = trade.tokenId === winningToken.tokenId;
  } else if (trade.outcome && winningToken.outcome) {
    tokenIsWinner = normalizeComparable(trade.outcome) === normalizeComparable(winningToken.outcome);
  }

  if (tokenIsWinner === null) {
    return null;
  }

  return trade.side === "BUY" ? tokenIsWinner : !tokenIsWinner;
}
