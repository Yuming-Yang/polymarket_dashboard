import { GammaMarketRaw } from "@/lib/polymarket/types";

import { MacroCandidate } from "@/lib/polymarket/macro/select";

const CLOB_BASE_URL = process.env.POLYMARKET_CLOB_BASE_URL ?? "https://clob.polymarket.com";
const REQUEST_TIMEOUT_MS = 7_000;
const MAX_RETRIES = 1;

type ClobInterval = "1d" | "1w";

type ClobHistoryPoint = {
  p?: string | number;
};

type ClobHistoryResponse = {
  history?: Array<ClobHistoryPoint | [number, number] | [number, string] | [string, number] | [string, string]>;
};

type FetchHistoryOptions = {
  interval: ClobInterval;
  noStore?: boolean;
};

export type MacroClobEnrichedCandidate = {
  candidate: MacroCandidate;
  change1dClob: number | null;
  change1wClob: number | null;
  clobMeta: {
    hasToken: boolean;
    has1dHistory: boolean;
    has1wHistory: boolean;
  };
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

function isRetriableStatus(status: number) {
  return status >= 500 && status < 600;
}

function parseTokenArray(raw: GammaMarketRaw["clobTokenIds"]): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((value) => (typeof value === "string" || typeof value === "number" ? String(value) : null))
      .filter((value): value is string => Boolean(value));
  }

  if (typeof raw !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((value) => (typeof value === "string" || typeof value === "number" ? String(value) : null))
      .filter((value): value is string => Boolean(value));
  } catch {
    return [];
  }
}

function parseHistoryStartPrice(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const history = (payload as ClobHistoryResponse).history;
  if (!Array.isArray(history) || history.length === 0) {
    return null;
  }

  const firstPoint = history[0];

  if (Array.isArray(firstPoint)) {
    return toNumber(firstPoint[1] ?? firstPoint[0]);
  }

  return toNumber(firstPoint?.p);
}

async function requestClobHistory(tokenId: string, options: FetchHistoryOptions): Promise<number | null> {
  const url = new URL("/prices-history", CLOB_BASE_URL);
  const fidelity = options.interval === "1d" ? "60" : "360";

  url.searchParams.set("market", tokenId);
  url.searchParams.set("interval", options.interval);
  url.searchParams.set("fidelity", fidelity);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        signal: controller.signal,
        cache: options.noStore ? "no-store" : "force-cache",
      });

      if (!response.ok) {
        if (!isRetriableStatus(response.status) || attempt === MAX_RETRIES) {
          return null;
        }

        lastError = new Error(`CLOB status ${response.status}`);
        continue;
      }

      const payload = (await response.json()) as unknown;
      return parseHistoryStartPrice(payload);
    } catch (error) {
      const isAbortError = error instanceof Error && error.name === "AbortError";
      const isRetryableNetworkError = error instanceof TypeError || isAbortError;

      if (attempt === MAX_RETRIES || !isRetryableNetworkError) {
        return null;
      }

      lastError = error as Error;
    } finally {
      clearTimeout(timeout);
    }
  }

  if (lastError) {
    return null;
  }

  return null;
}

export function extractYesTokenId(rawMarket: GammaMarketRaw): string | null {
  const tokens = parseTokenArray(rawMarket.clobTokenIds);
  return tokens.length > 0 ? tokens[0] : null;
}

async function enrichOneCandidate(candidate: MacroCandidate, noStore?: boolean): Promise<MacroClobEnrichedCandidate> {
  const yesTokenId = extractYesTokenId(candidate.rawMarket);

  if (!yesTokenId || candidate.expectationProb === null) {
    return {
      candidate,
      change1dClob: null,
      change1wClob: null,
      clobMeta: {
        hasToken: Boolean(yesTokenId),
        has1dHistory: false,
        has1wHistory: false,
      },
    };
  }

  const [price1d, price1w] = await Promise.all([
    requestClobHistory(yesTokenId, { interval: "1d", noStore }),
    requestClobHistory(yesTokenId, { interval: "1w", noStore }),
  ]);

  return {
    candidate,
    change1dClob: price1d === null ? null : candidate.expectationProb - price1d,
    change1wClob: price1w === null ? null : candidate.expectationProb - price1w,
    clobMeta: {
      hasToken: true,
      has1dHistory: price1d !== null,
      has1wHistory: price1w !== null,
    },
  };
}

async function mapWithConcurrency<TInput, TResult>(
  items: TInput[],
  concurrency: number,
  mapper: (item: TInput, index: number) => Promise<TResult>,
): Promise<TResult[]> {
  if (items.length === 0) {
    return [];
  }

  const normalizedConcurrency = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array<TResult>(items.length);
  let cursor = 0;

  const workers = Array.from({ length: normalizedConcurrency }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
}

export async function enrichCandidatesWithClobChanges(
  candidates: MacroCandidate[],
  options?: { noStore?: boolean; concurrency?: number },
): Promise<MacroClobEnrichedCandidate[]> {
  const concurrency = options?.concurrency ?? 10;

  return mapWithConcurrency(candidates, concurrency, async (candidate) => enrichOneCandidate(candidate, options?.noStore));
}
