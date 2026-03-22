import "server-only";

import {
  ClobTrade,
  InsiderTradeSide,
  MarketDetail,
  MarketToken,
  PublicTradeBatch,
  TradeLedgerRow,
  TradeNormalizationDiagnostics,
  TradeNormalizationRejectReason,
} from "@/lib/insider/types";

const TRADES_BASE_URL =
  process.env.POLYMARKET_DATA_API_BASE_URL ?? "https://data-api.polymarket.com";
const GAMMA_BASE_URL =
  process.env.POLYMARKET_GAMMA_BASE_URL ?? "https://gamma-api.polymarket.com";
const REQUEST_TIMEOUT_MS = 12_000;
const MAX_RETRIES = 1;
const DEFAULT_MINIMUM_TRACKED_TRADE_USDC = 500;
const MAX_TRADE_PAGE_LIMIT = 100;
const DEFAULT_SCAN_OVERLAP_MS = 5 * 60 * 1_000;
const MAX_ACTIVE_MARKET_CANDIDATES = 200;
const ACTIVE_MARKET_PAGE_LIMIT = 100;
const DEFAULT_MARKET_TRADE_MAX_PAGES = 3;

type RequestSource = "data-api" | "gamma";

type NormalizedTradeResult = {
  trade: ClobTrade | null;
  rejectReason: TradeNormalizationRejectReason | null;
};

export const INSIDER_UPSTREAM_ENDPOINTS = {
  tradesBaseUrl: TRADES_BASE_URL,
  gammaBaseUrl: GAMMA_BASE_URL,
} as const;

export class InsiderUpstreamError extends Error {
  upstreamStatus: number;
  kind: "http" | "timeout" | "network";
  source: RequestSource;
  url: string;

  constructor(
    message: string,
    options: {
      upstreamStatus?: number;
      kind: "http" | "timeout" | "network";
      source: RequestSource;
      url: string;
      cause?: unknown;
    },
  ) {
    super(message, { cause: options.cause });
    this.name = "InsiderUpstreamError";
    this.upstreamStatus = options.upstreamStatus ?? 0;
    this.kind = options.kind;
    this.source = options.source;
    this.url = options.url;
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

  if (
    Math.abs(numeric) >= 1_000_000 ||
    (Number.isInteger(numeric) && Math.abs(numeric) >= 100_000)
  ) {
    return numeric / 1_000_000;
  }

  return numeric;
}

export function normalizeShareSize(value: unknown) {
  const numeric = toNumber(value);
  if (numeric === null) {
    return null;
  }

  if (
    Math.abs(numeric) >= 1_000_000 ||
    (Number.isInteger(numeric) && Math.abs(numeric) >= 100_000)
  ) {
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
  const transactionHash = toString(
    record.transactionHash ?? record.transaction_hash ?? record.hash,
  );
  if (!transactionHash) {
    return null;
  }

  const components = [
    transactionHash,
    toString(record.conditionId ?? record.condition_id) ?? "condition",
    toString(record.asset) ?? "asset",
    toString(record.proxyWallet ?? record.proxy_wallet) ?? "wallet",
    toString(record.side) ?? "side",
    toString(record.timestamp) ?? "time",
    toString(record.size) ?? "size",
  ];

  return components.join(":");
}

function errorHasCode(error: unknown, code: string): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as { code?: unknown; cause?: unknown };
  if (record.code === code) {
    return true;
  }

  return errorHasCode(record.cause, code);
}

function toUpstreamNetworkError(
  error: unknown,
  source: RequestSource,
  url: string,
) {
  const isAbortError = error instanceof Error && error.name === "AbortError";
  const isTimeout =
    isAbortError ||
    errorHasCode(error, "UND_ERR_CONNECT_TIMEOUT") ||
    errorHasCode(error, "ETIMEDOUT");

  if (error instanceof InsiderUpstreamError) {
    return error;
  }

  return new InsiderUpstreamError(
    isTimeout
      ? "Upstream request timed out"
      : "Upstream network request failed",
    {
      kind: isTimeout ? "timeout" : "network",
      source,
      url,
      cause: error,
    },
  );
}

async function requestJson(
  url: URL,
  options: {
    source: RequestSource;
    cache?: RequestCache;
  },
): Promise<unknown> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        cache: options.cache ?? "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = new InsiderUpstreamError(
          `Upstream request failed with status ${response.status}`,
          {
            upstreamStatus: response.status,
            kind: "http",
            source: options.source,
            url: url.toString(),
          },
        );

        if (
          response.status === 429 ||
          !isRetriableStatus(response.status) ||
          attempt === MAX_RETRIES
        ) {
          throw error;
        }

        lastError = error;
        continue;
      }

      return await response.json();
    } catch (error) {
      const isAbortError =
        error instanceof Error && error.name === "AbortError";
      const isRetryableNetworkError =
        error instanceof TypeError || isAbortError;

      if (
        error instanceof InsiderUpstreamError &&
        (error.upstreamStatus === 429 ||
          !isRetriableStatus(error.upstreamStatus))
      ) {
        throw error;
      }

      if (attempt === MAX_RETRIES || !isRetryableNetworkError) {
        throw toUpstreamNetworkError(error, options.source, url.toString());
      }

      lastError = toUpstreamNetworkError(error, options.source, url.toString());
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

export function normalizeMarketDetail(
  raw: unknown,
  fallbackConditionId: string,
): MarketDetail {
  const record =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const conditionId =
    toString(record.conditionId ?? record.condition_id) ?? fallbackConditionId;
  const parsedTokens = Array.isArray(record.tokens)
    ? record.tokens.map(normalizeToken).filter(Boolean)
    : [];
  const tokens = parsedTokens as MarketToken[];

  if (tokens.length === 0) {
    const tokenIds = parseJsonArray(record.clobTokenIds ?? record.clobTokenIDS);
    const outcomes = parseJsonArray(record.outcomes);
    const winnerOutcome = toString(
      record.winner ?? record.winningOutcome ?? record.winning_outcome,
    );

    for (
      let index = 0;
      index < Math.max(tokenIds.length, outcomes.length);
      index += 1
    ) {
      const tokenId = toString(tokenIds[index] ?? null);
      const outcome = toString(outcomes[index] ?? null);
      tokens.push({
        tokenId,
        outcome,
        winner:
          outcome !== null && winnerOutcome !== null
            ? outcome.toLowerCase() === winnerOutcome.toLowerCase()
            : false,
      });
    }
  }

  return {
    id: conditionId,
    conditionId,
    gammaMarketId: toString(record.id),
    slug: toString(record.slug),
    title: toString(record.question ?? record.title) ?? "Unknown market",
    volume24h: toNumber(
      record.volume24hr ?? record.volume24Hr ?? record.volume24h,
    ),
    active: toBoolean(record.active) ?? true,
    resolved: toBoolean(record.resolved) ?? false,
    closed: toBoolean(record.closed) ?? false,
    tokens,
  };
}

function emptyTradeDiagnostics(rawCount = 0): TradeNormalizationDiagnostics {
  return {
    rawCount,
    normalizedCount: 0,
    duplicateCount: 0,
    rejectedByReason: {},
  };
}

function recordRejectReason(
  diagnostics: TradeNormalizationDiagnostics,
  reason: TradeNormalizationRejectReason,
) {
  diagnostics.rejectedByReason[reason] =
    (diagnostics.rejectedByReason[reason] ?? 0) + 1;
}

function mergeTradeDiagnostics(
  target: TradeNormalizationDiagnostics,
  source: TradeNormalizationDiagnostics,
) {
  target.rawCount += source.rawCount;
  target.normalizedCount += source.normalizedCount;
  target.duplicateCount += source.duplicateCount;

  for (const [reason, count] of Object.entries(
    source.rejectedByReason,
  ) as Array<[TradeNormalizationRejectReason, number]>) {
    target.rejectedByReason[reason] =
      (target.rejectedByReason[reason] ?? 0) + count;
  }
}

function normalizePublicTradeResult(
  raw: unknown,
  options: { minimumSizeUsdc?: number } = {},
): NormalizedTradeResult {
  if (!raw || typeof raw !== "object") {
    return {
      trade: null,
      rejectReason: "invalid_record",
    };
  }

  const minimumSizeUsdc =
    options.minimumSizeUsdc ?? DEFAULT_MINIMUM_TRACKED_TRADE_USDC;
  const record = raw as Record<string, unknown>;
  const tradeId = toString(record.id) ?? buildSyntheticTradeId(record);
  const marketId = toString(record.conditionId ?? record.condition_id);
  const wallet =
    toString(record.proxyWallet ?? record.proxy_wallet)?.toLowerCase() ?? null;
  const side = normalizeSide(record.side);
  const price = toNumber(record.price);
  const shareSize = normalizeShareSize(record.size);
  const sizeUsdc =
    shareSize !== null && price !== null ? shareSize * price : null;
  const timestamp = normalizeTimestamp(record.timestamp);

  if (!tradeId) {
    return {
      trade: null,
      rejectReason: "missing_trade_id",
    };
  }

  if (!marketId) {
    return {
      trade: null,
      rejectReason: "missing_market_id",
    };
  }

  if (!wallet) {
    return {
      trade: null,
      rejectReason: "missing_wallet",
    };
  }

  if (!side) {
    return {
      trade: null,
      rejectReason: "missing_side",
    };
  }

  if (price === null || price <= 0) {
    return {
      trade: null,
      rejectReason: "invalid_price",
    };
  }

  if (
    sizeUsdc === null ||
    sizeUsdc <= 0 ||
    shareSize === null ||
    shareSize <= 0
  ) {
    return {
      trade: null,
      rejectReason: "invalid_size",
    };
  }

  if (!timestamp) {
    return {
      trade: null,
      rejectReason: "missing_timestamp",
    };
  }

  if (sizeUsdc < minimumSizeUsdc) {
    return {
      trade: null,
      rejectReason: "below_minimum_size",
    };
  }

  return {
    trade: {
      tradeId,
      marketId,
      marketSlug: toString(
        record.eventSlug ?? record.event_slug ?? record.slug,
      ),
      marketTitle: toString(record.title ?? record.question),
      wallet,
      tokenId: toString(record.asset),
      outcome: toString(record.outcome),
      side,
      price,
      sizeUsdc,
      shareSize,
      timestamp: timestamp.iso,
      timestampMs: timestamp.ms,
      raw: record,
    },
    rejectReason: null,
  };
}

export function normalizeClobTrade(
  raw: unknown,
  options: { minimumSizeUsdc?: number } = {},
) {
  return normalizePublicTradeResult(raw, options).trade;
}

function extractRawList(json: unknown) {
  if (Array.isArray(json)) {
    return json;
  }

  if (
    json &&
    typeof json === "object" &&
    Array.isArray((json as { data?: unknown[] }).data)
  ) {
    return (json as { data: unknown[] }).data;
  }

  return [];
}

function dedupeTrades(trades: ClobTrade[]) {
  const seenTradeIds = new Set<string>();
  const uniqueTrades: ClobTrade[] = [];
  let duplicateCount = 0;

  for (const trade of trades) {
    if (seenTradeIds.has(trade.tradeId)) {
      duplicateCount += 1;
      continue;
    }

    seenTradeIds.add(trade.tradeId);
    uniqueTrades.push(trade);
  }

  return {
    trades: uniqueTrades,
    duplicateCount,
  };
}

export async function fetchRecentTrades(
  params: {
    limit?: number;
    offset?: number;
    marketId?: string;
    takerOnly?: boolean;
    filterType?: string;
    filterAmount?: number;
    minimumSizeUsdc?: number;
  } = {},
): Promise<PublicTradeBatch> {
  const url = new URL("/trades", TRADES_BASE_URL);
  const limit = Math.min(
    MAX_TRADE_PAGE_LIMIT,
    Math.max(1, params.limit ?? MAX_TRADE_PAGE_LIMIT),
  );
  const offset = Math.max(0, Math.trunc(params.offset ?? 0));
  const minimumSizeUsdc =
    params.minimumSizeUsdc ?? DEFAULT_MINIMUM_TRACKED_TRADE_USDC;

  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("takerOnly", String(params.takerOnly ?? false));

  if (params.marketId) {
    url.searchParams.set("market", params.marketId);
  }

  if (params.filterType) {
    url.searchParams.set("filterType", params.filterType);
  }

  if (
    typeof params.filterAmount === "number" &&
    Number.isFinite(params.filterAmount) &&
    params.filterAmount > 0
  ) {
    url.searchParams.set("filterAmount", String(params.filterAmount));
  }

  const json = await requestJson(url, {
    source: "data-api",
  });
  const rawTrades = extractRawList(json);
  const diagnostics = emptyTradeDiagnostics(rawTrades.length);
  const trades: ClobTrade[] = [];

  for (const rawTrade of rawTrades) {
    const result = normalizePublicTradeResult(rawTrade, {
      minimumSizeUsdc,
    });

    if (result.trade) {
      trades.push(result.trade);
      diagnostics.normalizedCount += 1;
      continue;
    }

    if (result.rejectReason) {
      recordRejectReason(diagnostics, result.rejectReason);
    }
  }

  const deduped = dedupeTrades(trades);
  diagnostics.duplicateCount += deduped.duplicateCount;

  return {
    trades: deduped.trades,
    diagnostics,
  };
}

export async function fetchMarketTrades(params: {
  marketId: string;
  limit?: number;
  maxPages?: number;
  afterTimestampMs?: number | null;
  overlapMs?: number;
  filterType?: string;
  filterAmount?: number;
  minimumSizeUsdc?: number;
}): Promise<PublicTradeBatch> {
  const limit = Math.min(
    MAX_TRADE_PAGE_LIMIT,
    Math.max(1, params.limit ?? MAX_TRADE_PAGE_LIMIT),
  );
  const maxPages = Math.min(
    10,
    Math.max(1, params.maxPages ?? DEFAULT_MARKET_TRADE_MAX_PAGES),
  );
  const overlapMs = Math.max(0, params.overlapMs ?? DEFAULT_SCAN_OVERLAP_MS);
  const cutoffMs =
    typeof params.afterTimestampMs === "number" &&
    Number.isFinite(params.afterTimestampMs)
      ? Math.max(0, params.afterTimestampMs - overlapMs)
      : null;
  const diagnostics = emptyTradeDiagnostics();
  const collectedTrades: ClobTrade[] = [];

  for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
    const page = await fetchRecentTrades({
      marketId: params.marketId,
      limit,
      offset: pageIndex * limit,
      takerOnly: false,
      filterType: params.filterType ?? "CASH",
      filterAmount: params.filterAmount ?? DEFAULT_MINIMUM_TRACKED_TRADE_USDC,
      minimumSizeUsdc:
        params.minimumSizeUsdc ?? DEFAULT_MINIMUM_TRACKED_TRADE_USDC,
    });

    mergeTradeDiagnostics(diagnostics, page.diagnostics);

    for (const trade of page.trades) {
      if (cutoffMs === null || trade.timestampMs > cutoffMs) {
        collectedTrades.push(trade);
      }
    }

    if (page.diagnostics.rawCount === 0 || page.diagnostics.rawCount < limit) {
      break;
    }

    if (cutoffMs !== null && page.trades.length > 0) {
      const oldestTimestampMs = page.trades.reduce(
        (minimum, trade) => Math.min(minimum, trade.timestampMs),
        Number.POSITIVE_INFINITY,
      );
      if (oldestTimestampMs <= cutoffMs) {
        break;
      }
    }
  }

  const deduped = dedupeTrades(collectedTrades);
  diagnostics.duplicateCount += deduped.duplicateCount;

  return {
    trades: deduped.trades.sort(
      (left, right) => left.timestampMs - right.timestampMs,
    ),
    diagnostics,
  };
}

export async function fetchMarketAverageTradeSize(
  marketId: string,
  limit = MAX_TRADE_PAGE_LIMIT,
) {
  const batch = await fetchMarketTrades({
    marketId,
    limit,
    maxPages: 1,
    minimumSizeUsdc: DEFAULT_MINIMUM_TRACKED_TRADE_USDC,
  });

  if (batch.trades.length === 0) {
    return null;
  }

  const totalSizeUsdc = batch.trades.reduce(
    (sum, trade) => sum + trade.sizeUsdc,
    0,
  );
  return totalSizeUsdc / batch.trades.length;
}

async function fetchGammaMarkets(params: {
  limit?: number;
  offset?: number;
  conditionIds?: string[];
  active?: boolean;
  closed?: boolean;
  order?: string;
  ascending?: boolean;
  cache?: RequestCache;
}) {
  const url = new URL("/markets", GAMMA_BASE_URL);

  if (
    typeof params.limit === "number" &&
    Number.isFinite(params.limit) &&
    params.limit > 0
  ) {
    url.searchParams.set(
      "limit",
      String(
        Math.min(
          ACTIVE_MARKET_PAGE_LIMIT,
          Math.max(1, Math.trunc(params.limit)),
        ),
      ),
    );
  }

  if (
    typeof params.offset === "number" &&
    Number.isFinite(params.offset) &&
    params.offset >= 0
  ) {
    url.searchParams.set("offset", String(Math.trunc(params.offset)));
  }

  if (params.conditionIds && params.conditionIds.length > 0) {
    url.searchParams.set("condition_ids", params.conditionIds.join(","));
  }

  if (typeof params.active === "boolean") {
    url.searchParams.set("active", String(params.active));
  }

  if (typeof params.closed === "boolean") {
    url.searchParams.set("closed", String(params.closed));
  }

  if (params.order) {
    url.searchParams.set("order", params.order);
  }

  if (typeof params.ascending === "boolean") {
    url.searchParams.set("ascending", String(params.ascending));
  }

  url.searchParams.set("include_tag", "false");

  const json = await requestJson(url, {
    source: "gamma",
    cache: params.cache ?? "no-store",
  });

  return extractRawList(json);
}

export async function fetchCandidateMarketsForScan(
  params: { limit?: number } = {},
) {
  const requestedLimit = Math.min(
    MAX_ACTIVE_MARKET_CANDIDATES,
    Math.max(1, params.limit ?? MAX_ACTIVE_MARKET_CANDIDATES),
  );
  const candidates: MarketDetail[] = [];
  const seenConditionIds = new Set<string>();
  let offset = 0;
  let shouldStop = false;

  while (candidates.length < requestedLimit && !shouldStop) {
    const rawMarkets = await fetchGammaMarkets({
      active: true,
      closed: false,
      order: "volume24hr",
      ascending: false,
      limit: ACTIVE_MARKET_PAGE_LIMIT,
      offset,
    });

    if (rawMarkets.length === 0) {
      break;
    }

    for (const rawMarket of rawMarkets) {
      const record =
        rawMarket && typeof rawMarket === "object"
          ? (rawMarket as Record<string, unknown>)
          : null;
      const conditionId = record
        ? toString(record.conditionId ?? record.condition_id)
        : null;

      if (!conditionId || seenConditionIds.has(conditionId)) {
        continue;
      }

      const market = normalizeMarketDetail(rawMarket, conditionId);
      if (!market.active || market.closed) {
        continue;
      }

      if ((market.volume24h ?? 0) <= 0) {
        shouldStop = true;
        break;
      }

      seenConditionIds.add(conditionId);
      candidates.push(market);

      if (candidates.length >= requestedLimit) {
        shouldStop = true;
        break;
      }
    }

    if (rawMarkets.length < ACTIVE_MARKET_PAGE_LIMIT) {
      break;
    }

    offset += ACTIVE_MARKET_PAGE_LIMIT;
  }

  return candidates;
}

export async function fetchMarketDetail(conditionId: string) {
  const markets = await fetchGammaMarkets({
    conditionIds: [conditionId],
    limit: 1,
  });

  return normalizeMarketDetail(markets[0] ?? {}, conditionId);
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
    tokenIsWinner =
      normalizeComparable(trade.outcome) ===
      normalizeComparable(winningToken.outcome);
  }

  if (tokenIsWinner === null) {
    return null;
  }

  return trade.side === "BUY" ? tokenIsWinner : !tokenIsWinner;
}
