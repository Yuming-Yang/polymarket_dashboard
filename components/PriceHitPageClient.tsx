"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AlertTriangle, ExternalLink, RefreshCw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PRICE_HIT_ASSETS, parsePriceHitAssetKey } from "@/lib/price-hit/assets";
import { formatProbability, formatRelativeUpdatedAt, formatUsd } from "@/lib/format";
import { priceHitRefreshResponseSchema } from "@/lib/polymarket/schemas";
import { PriceHitDistributionBucket, PriceHitExpiryDistribution, PriceHitRefreshResponse } from "@/lib/polymarket/types";
import { usePriceHit } from "@/lib/query/usePriceHit";
import { cn } from "@/lib/utils";

type PriceHitPageState = {
  asset: ReturnType<typeof parsePriceHitAssetKey>;
  expiry: string | null;
};

type RefreshBannerState = {
  tone: "neutral" | "success" | "error";
  message: string;
} | null;

function parseSearchParams(searchParams: URLSearchParams): PriceHitPageState {
  const rawExpiry = searchParams.get("expiry");

  return {
    asset: parsePriceHitAssetKey(searchParams.get("asset")),
    expiry: rawExpiry && rawExpiry.trim().length > 0 ? rawExpiry : null,
  };
}

function formatPrice(value: number | null, options?: { compact?: boolean }) {
  if (value === null || Number.isNaN(value)) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: options?.compact ? "compact" : "standard",
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

function formatExpiryLabel(expiryDate: string) {
  const parsed = new Date(`${expiryDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return expiryDate;
  }

  const month = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(parsed);
  const year = new Intl.DateTimeFormat("en-US", { year: "2-digit", timeZone: "UTC" }).format(parsed);
  return `${month} '${year}`;
}

function formatExpiryHeading(expiryDate: string) {
  const parsed = new Date(`${expiryDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return expiryDate;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function bucketFill(bucket: PriceHitDistributionBucket, index: number, total: number) {
  if (bucket.kind === "lower" || bucket.kind === "upper") {
    return "#d9e5f2";
  }

  const center = (total - 1) / 2;
  const distance = Math.abs(index - center);
  const ratio = total <= 1 ? 1 : 1 - Math.min(1, distance / Math.max(center, 1));

  if (ratio > 0.72) {
    return "#2f6fb0";
  }

  if (ratio > 0.42) {
    return "#4f8ec7";
  }

  return "#8eb5d8";
}

function DistributionChart({ assetLabel, expiry }: { assetLabel: string; expiry: PriceHitExpiryDistribution }) {
  const width = 920;
  const height = 380;
  const margin = { top: 20, right: 20, bottom: 52, left: 58 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const maxDensity = Math.max(...expiry.buckets.map((bucket) => bucket.probabilityDensity), 0.01);
  const xDomain = Math.max(expiry.chartMaxPrice - expiry.chartMinPrice, 1);
  const tickCount = 5;
  const strikeTickStep = Math.max(1, Math.ceil(expiry.strikePrices.length / 6));

  const xScale = (value: number) => margin.left + ((value - expiry.chartMinPrice) / xDomain) * plotWidth;
  const yScale = (value: number) => margin.top + plotHeight - (value / maxDensity) * plotHeight;

  return (
    <div className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-4 shadow-sm sm:p-6">
      <p className="text-lg font-medium tracking-tight text-slate-700">
        Implied probability distribution · {assetLabel} · {formatExpiryHeading(expiry.expiryDate)} expiry
      </p>
      <p className="mt-1 text-sm text-slate-500">Using event: {expiry.eventTitle}</p>

      <svg viewBox={`0 0 ${width} ${height}`} className="mt-4 h-[21rem] w-full" role="img" aria-label={`${assetLabel} distribution chart`}>
        {Array.from({ length: tickCount + 1 }).map((_, index) => {
          const value = (maxDensity / tickCount) * index;
          const y = yScale(value);

          return (
            <g key={index}>
              <line
                x1={margin.left}
                x2={width - margin.right}
                y1={y}
                y2={y}
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <text x={margin.left - 10} y={y + 4} textAnchor="end" fontSize="11" fill="#64748b">
                {new Intl.NumberFormat("en-US", {
                  style: "percent",
                  maximumFractionDigits: 0,
                }).format(value)}
              </text>
            </g>
          );
        })}

        <line x1={margin.left} x2={margin.left} y1={margin.top} y2={margin.top + plotHeight} stroke="#cbd5e1" strokeWidth="1.2" />
        <line
          x1={margin.left}
          x2={width - margin.right}
          y1={margin.top + plotHeight}
          y2={margin.top + plotHeight}
          stroke="#cbd5e1"
          strokeWidth="1.2"
        />

        {expiry.buckets.map((bucket, index) => {
          const x = xScale(bucket.startPrice) + 1;
          const width = Math.max(6, xScale(bucket.endPrice) - xScale(bucket.startPrice) - 2);
          const y = yScale(bucket.probabilityDensity);
          const barHeight = margin.top + plotHeight - y;

          return (
            <g key={bucket.key}>
              <title>
                {bucket.label}: {formatProbability(bucket.probabilityDensity)}
              </title>
              <rect
                x={x}
                y={y}
                width={width}
                height={Math.max(barHeight, 2)}
                rx={8}
                fill={bucketFill(bucket, index, expiry.buckets.length)}
              />
            </g>
          );
        })}

        {expiry.strikePrices.map((strikePrice, index) => {
          const shouldShowTick = index % strikeTickStep === 0 || index === expiry.strikePrices.length - 1;
          if (!shouldShowTick) {
            return null;
          }

          const x = xScale(strikePrice);
          return (
            <g key={strikePrice}>
              <line
                x1={x}
                x2={x}
                y1={margin.top + plotHeight}
                y2={margin.top + plotHeight + 6}
                stroke="#94a3b8"
                strokeWidth="1"
              />
              <text x={x} y={height - 16} textAnchor="middle" fontSize="11" fill="#64748b">
                {formatPrice(strikePrice, { compact: strikePrice >= 10_000 })}
              </text>
            </g>
          );
        })}

        <text
          x={width / 2}
          y={height - 2}
          textAnchor="middle"
          fontSize="12"
          fill="#64748b"
        >
          Strike price (USD)
        </text>
        <text
          x={16}
          y={height / 2}
          textAnchor="middle"
          fontSize="12"
          fill="#64748b"
          transform={`rotate(-90 16 ${height / 2})`}
        >
          Probability mass
        </text>
      </svg>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string;
  sublabel: string;
}) {
  return (
    <div className="rounded-[1.75rem] border border-amber-100 bg-amber-50/70 p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{sublabel}</p>
    </div>
  );
}

function UnderlyingMarketCard({ market }: { market: PriceHitExpiryDistribution["markets"][number] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900">{market.title}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
              {market.side === "high" ? "High side" : "Low side"}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
              Strike {formatPrice(market.strikePrice, { compact: market.strikePrice >= 10_000 })}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
              Volume {formatUsd(market.volumeTotalUsd ?? market.volume24hUsd)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <p className="text-xl font-semibold tracking-tight text-emerald-600">{formatProbability(market.probability)}</p>
          {market.url ? (
            <Link href={market.url} target="_blank" rel="noreferrer" className="text-slate-500 transition hover:text-slate-900">
              <ExternalLink className="h-4 w-4" />
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PriceHitLoadingState() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-11 w-20 rounded-full" />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-11 w-24 rounded-full" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <Skeleton className="h-6 w-96" />
          <Skeleton className="mt-6 h-[21rem] w-full rounded-3xl" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="mt-4 h-10 w-32" />
              <Skeleton className="mt-3 h-4 w-36" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="mt-3 h-4 w-40" />
          </div>
        ))}
      </div>
    </div>
  );
}

function PriceHitErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900 shadow-sm">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5" />
        <div>
          <h2 className="text-sm font-semibold">Unable to load price hit data</h2>
          <p className="mt-1 text-sm text-red-800">{message}</p>
          <Button variant="outline" className="mt-4 border-red-200 bg-white text-red-900" onClick={onRetry}>
            Retry
          </Button>
        </div>
      </div>
    </div>
  );
}

function PriceHitEmptyState({
  assetName,
  structuredEventCount,
}: {
  assetName: string;
  structuredEventCount: number;
}) {
  const message =
    structuredEventCount === 0
      ? `No price-hit style Polymarket events were classified for ${assetName}. Try the AI Refresh button later if new markets appear.`
      : `We found candidate ${assetName} price-hit events, but no liquid strike markets survived the live pricing filters right now.`;

  return (
    <Card className="border-slate-200/80 bg-white/95">
      <CardContent className="p-6">
        <h2 className="text-lg font-semibold tracking-tight text-slate-950">No usable price hit markets</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{message}</p>
      </CardContent>
    </Card>
  );
}

function summarizeRefreshResponse(payload: PriceHitRefreshResponse): RefreshBannerState {
  const refreshedCount = payload.results.filter((result) => result.status === "refreshed").length;
  const fallbackCount = payload.results.filter((result) => result.status === "stale_fallback").length;
  const failedResults = payload.results.filter((result) => result.status === "failed");
  const failedCount = failedResults.length;

  if (failedCount > 0) {
    const details = failedResults
      .slice(0, 3)
      .map((result) => `${result.assetLabel}: ${result.message ?? "Unknown error"}`)
      .join(" ");

    return {
      tone: "error",
      message: `AI refresh finished with ${failedCount} failed asset${failedCount === 1 ? "" : "s"}. ${details}`,
    };
  }

  if (fallbackCount > 0) {
    const fallbackDetails = payload.results
      .filter((result) => result.status === "stale_fallback")
      .slice(0, 3)
      .map((result) => `${result.assetLabel}: ${result.message ?? "Using previous cache."}`)
      .join(" ");

    return {
      tone: "neutral",
      message: `${refreshedCount} asset${refreshedCount === 1 ? "" : "s"} refreshed. ${fallbackCount} kept the previous cached AI result. ${fallbackDetails}`,
    };
  }

  return {
    tone: "success",
    message: `AI classifications refreshed for all ${payload.results.length} assets.`,
  };
}

export function PriceHitPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [clock, setClock] = useState(() => Date.now());
  const [isRefreshingAi, setIsRefreshingAi] = useState(false);
  const [refreshBanner, setRefreshBanner] = useState<RefreshBannerState>(null);

  const state = useMemo(() => parseSearchParams(searchParams), [searchParams]);
  const query = usePriceHit({
    asset: state.asset,
  });

  const selectedExpiry = useMemo(() => {
    if (!query.data) {
      return null;
    }

    return query.data.expiries.find((expiry) => expiry.expiryDate === state.expiry) ?? query.data.expiries.find((expiry) => expiry.expiryDate === query.data.defaultExpiry) ?? null;
  }, [query.data, state.expiry]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!query.data) {
      return;
    }

    const next = new URLSearchParams(searchParams.toString());
    let shouldReplace = false;

    if (next.get("asset") !== state.asset) {
      next.set("asset", state.asset);
      shouldReplace = true;
    }

    if (selectedExpiry?.expiryDate) {
      if (next.get("expiry") !== selectedExpiry.expiryDate) {
        next.set("expiry", selectedExpiry.expiryDate);
        shouldReplace = true;
      }
    } else if (next.has("expiry")) {
      next.delete("expiry");
      shouldReplace = true;
    }

    if (shouldReplace) {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    }
  }, [pathname, query.data, router, searchParams, selectedExpiry?.expiryDate, state.asset]);

  const updateSearchParamState = useCallback(
    (partial: Partial<PriceHitPageState>) => {
      const nextState: PriceHitPageState = {
        ...state,
        ...partial,
      };
      const next = new URLSearchParams(searchParams.toString());
      next.set("asset", nextState.asset);

      if (nextState.expiry) {
        next.set("expiry", nextState.expiry);
      } else {
        next.delete("expiry");
      }

      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams, state],
  );

  const onRetry = useCallback(() => {
    void query.refetch();
  }, [query]);

  const onAiRefresh = useCallback(async () => {
    setIsRefreshingAi(true);
    setRefreshBanner({
      tone: "neutral",
      message: "Refreshing AI classifications for all assets...",
    });

    try {
      const response = await fetch("/api/polymarket/price-hit/refresh", {
        method: "POST",
      });
      const json = await response.json();

      if (json?.results) {
        const payload = priceHitRefreshResponseSchema.parse(json);
        setRefreshBanner(summarizeRefreshResponse(payload));
      } else {
        const message = typeof json?.error?.message === "string" ? json.error.message : "Failed to refresh AI classifications.";
        setRefreshBanner({
          tone: "error",
          message,
        });
      }

      await queryClient.invalidateQueries({
        queryKey: ["price-hit"],
      });
      await query.refetch();
    } catch (error) {
      setRefreshBanner({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to refresh AI classifications.",
      });
    } finally {
      setIsRefreshingAi(false);
    }
  }, [query, queryClient]);

  const statusLabel = formatRelativeUpdatedAt(query.data?.fetchedAt ?? null, clock);
  const aiStatusLabel = query.data?.aiRefreshedAt ? formatRelativeUpdatedAt(query.data.aiRefreshedAt, clock) : "AI cache pending";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Module 5"
        title="Price Hit"
        subtitle="Turn Polymarket strike markets into an implied price distribution for a fixed watchlist of assets."
      />

      <div className="rounded-[2rem] border border-slate-200/80 bg-white/95 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {PRICE_HIT_ASSETS.map((asset) => (
              <button
                key={asset.key}
                type="button"
                onClick={() => updateSearchParamState({ asset: asset.key, expiry: null })}
                className={cn(
                  "rounded-full border px-4 py-2.5 text-sm font-medium transition",
                  state.asset === asset.key
                    ? "border-slate-950 bg-slate-950 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-900 hover:text-slate-950",
                )}
              >
                {asset.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {query.data ? (
              <div className="text-right">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Live prices</p>
                <p className="mt-1 text-sm text-slate-500">{statusLabel}</p>
              </div>
            ) : null}

            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">AI cache</p>
              <p className="mt-1 text-sm text-slate-500">{aiStatusLabel}</p>
            </div>

            <Button
              onClick={onAiRefresh}
              disabled={isRefreshingAi}
              className="h-11 rounded-full px-5"
              aria-label="AI Refresh"
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshingAi && "animate-spin")} />
              {isRefreshingAi ? "Refreshing..." : "AI Refresh"}
            </Button>
          </div>
        </div>
      </div>

      {refreshBanner ? (
        <div
          className={cn(
            "rounded-2xl border p-4 text-sm shadow-sm",
            refreshBanner.tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-900",
            refreshBanner.tone === "neutral" && "border-slate-200 bg-slate-50 text-slate-700",
            refreshBanner.tone === "error" && "border-red-200 bg-red-50 text-red-900",
          )}
        >
          {refreshBanner.message}
        </div>
      ) : null}

      {query.isError && !query.data ? <PriceHitErrorState message={query.error.message} onRetry={onRetry} /> : null}

      {query.isLoading && !query.data ? <PriceHitLoadingState /> : null}

      {query.data ? (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="space-y-4"
        >
          {query.data.expiries.length > 0 ? (
            <>
              <div className="flex flex-col gap-4 rounded-[2rem] border border-slate-200/80 bg-white/95 p-4 shadow-sm sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Expiries</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {query.data.structuredEventCount} AI-structured event{query.data.structuredEventCount === 1 ? "" : "s"} · cache status{" "}
                      <span className="font-medium text-slate-700">{query.data.aiCacheStatus.replace("_", " ")}</span>
                    </p>
                  </div>

                  {query.isFetching ? (
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm font-medium text-slate-600">
                      Refreshing live prices...
                    </motion.p>
                  ) : (
                    <button
                      type="button"
                      onClick={onRetry}
                      className="text-sm font-medium text-slate-700 underline-offset-2 hover:text-slate-950 hover:underline"
                    >
                      Refresh prices
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {query.data.expiries.map((expiry) => (
                    <button
                      key={expiry.expiryDate}
                      type="button"
                      onClick={() => updateSearchParamState({ expiry: expiry.expiryDate })}
                      className={cn(
                        "rounded-full border px-4 py-2.5 text-sm font-medium transition",
                        selectedExpiry?.expiryDate === expiry.expiryDate
                          ? "border-amber-200 bg-amber-50 text-slate-950"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-900 hover:text-slate-950",
                      )}
                    >
                      {formatExpiryLabel(expiry.expiryDate)}
                    </button>
                  ))}
                </div>
              </div>

              {selectedExpiry ? (
                <>
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
                    <DistributionChart assetLabel={query.data.assetLabel} expiry={selectedExpiry} />

                    <div className="space-y-4">
                      <SummaryCard
                        label="Implied median"
                        value={formatPrice(selectedExpiry.impliedMedianPrice)}
                        sublabel="Median of the repaired survival curve"
                      />
                      <SummaryCard
                        label="90% range"
                        value={`${formatPrice(selectedExpiry.range90Low)} - ${formatPrice(selectedExpiry.range90High)}`}
                        sublabel="5th to 95th percentile range"
                      />
                      <SummaryCard
                        label="Strike prices used"
                        value={String(selectedExpiry.strikeCount)}
                        sublabel="Unique liquid strikes after dedupe"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Underlying markets</p>
                      <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">Raw markets used</h2>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      {selectedExpiry.markets.map((market) => (
                        <UnderlyingMarketCard key={market.marketId} market={market} />
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
            </>
          ) : (
            <PriceHitEmptyState assetName={query.data.assetName} structuredEventCount={query.data.structuredEventCount} />
          )}
        </motion.div>
      ) : null}
    </div>
  );
}
