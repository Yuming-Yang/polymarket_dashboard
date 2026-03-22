import { TopVolumeWindow } from "@/lib/polymarket/types";

const GAMMA_BASE_URL = process.env.POLYMARKET_GAMMA_BASE_URL ?? "https://gamma-api.polymarket.com";
const REQUEST_TIMEOUT_MS = 9_000;
const MAX_RETRIES = 1;

type FetchGammaParams = {
  window: TopVolumeWindow;
  limit: number;
  noStore?: boolean;
};

export class UpstreamHttpError extends Error {
  upstreamStatus: number;

  constructor(message: string, upstreamStatus: number) {
    super(message);
    this.name = "UpstreamHttpError";
    this.upstreamStatus = upstreamStatus;
  }
}

function isRetriableStatus(status: number) {
  return status >= 500 && status < 600;
}

function clampCandidateLimit(limit: number) {
  return Math.min(500, Math.max(100, limit));
}

function clampWideCandidateLimit(limit: number) {
  return Math.min(1_000, Math.max(100, limit));
}

function clampSearchLimit(limit: number) {
  return Math.min(25, Math.max(5, limit));
}

async function requestGamma(
  path: string,
  params: Record<string, string>,
  options: { noStore?: boolean },
): Promise<unknown> {
  const url = new URL(path, GAMMA_BASE_URL);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

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
        const message = `Gamma API responded with status ${response.status}`;
        const upstreamError = new UpstreamHttpError(message, response.status);

        if (response.status === 429 || !isRetriableStatus(response.status) || attempt === MAX_RETRIES) {
          throw upstreamError;
        }

        lastError = upstreamError;
        continue;
      }

      return await response.json();
    } catch (error) {
      const isAbortError = error instanceof Error && error.name === "AbortError";
      const isRetryableNetworkError = error instanceof TypeError || isAbortError;

      if (error instanceof UpstreamHttpError && (error.upstreamStatus === 429 || !isRetriableStatus(error.upstreamStatus))) {
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

  throw lastError ?? new Error("Gamma API request failed after retries");
}

export async function fetchMarkets(params: FetchGammaParams) {
  const order = params.window === "24h" ? "volume24hr" : "volumeNum";

  return requestGamma(
    "/markets",
    {
      active: "true",
      closed: "false",
      include_tag: "true",
      ascending: "false",
      order,
      limit: String(clampCandidateLimit(params.limit)),
    },
    { noStore: params.noStore },
  );
}

export async function fetchEvents(params: FetchGammaParams) {
  const order = params.window === "24h" ? "volume24hr" : "volume";

  return requestGamma(
    "/events",
    {
      active: "true",
      closed: "false",
      include_tag: "true",
      ascending: "false",
      order,
      limit: String(clampCandidateLimit(params.limit)),
    },
    { noStore: params.noStore },
  );
}

export async function fetchMarketsForBreaking(params: { limit: number; noStore?: boolean }) {
  return requestGamma(
    "/markets",
    {
      active: "true",
      closed: "false",
      include_tag: "true",
      ascending: "false",
      order: "volume24hr",
      limit: String(clampWideCandidateLimit(params.limit)),
    },
    { noStore: params.noStore },
  );
}

export async function fetchPublicSearch(params: { query: string; limit: number; noStore?: boolean }) {
  return requestGamma(
    "/public-search",
    {
      q: params.query,
      limit_per_type: String(clampSearchLimit(params.limit)),
      optimized: "true",
    },
    { noStore: params.noStore },
  );
}

export async function fetchEventById(params: { eventId: string; noStore?: boolean }) {
  return requestGamma(`/events/${encodeURIComponent(params.eventId)}`, {}, { noStore: params.noStore });
}
