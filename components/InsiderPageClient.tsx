"use client";

import { motion } from "framer-motion";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { InsiderAlertCard } from "@/components/InsiderAlertCard";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelativeUpdatedAt } from "@/lib/format";
import { useInsiderAlerts } from "@/lib/query/useInsiderAlerts";
import { cn } from "@/lib/utils";

const SCORE_OPTIONS = [5, 6, 7, 8] as const;
const DEFAULT_LIMIT = 50;

type InsiderControlState = {
  minScore: (typeof SCORE_OPTIONS)[number];
  limit: number;
  marketId: string | null;
};

function parseSearchParams(searchParams: URLSearchParams): InsiderControlState {
  const minScore = Number(searchParams.get("minScore") ?? "6");
  const limit = Number(searchParams.get("limit") ?? String(DEFAULT_LIMIT));
  const marketId = searchParams.get("marketId");

  return {
    minScore: SCORE_OPTIONS.includes(minScore as (typeof SCORE_OPTIONS)[number])
      ? (minScore as (typeof SCORE_OPTIONS)[number])
      : 6,
    limit: Number.isFinite(limit) ? Math.min(100, Math.max(1, Math.round(limit))) : DEFAULT_LIMIT,
    marketId: marketId && marketId.trim() !== "" ? marketId : null,
  };
}

function formatScanLabel(value: string | null, now: number) {
  const relativeLabel = formatRelativeUpdatedAt(value, now);
  return relativeLabel.replace(/^Updated/, "Last scan");
}

function InsiderLoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900 shadow-sm">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5" />
        <div>
          <h2 className="text-sm font-semibold">Unable to load insider alerts</h2>
          <p className="mt-1 text-sm text-red-800">{message}</p>
          <Button variant="outline" className="mt-4 border-red-200 bg-white text-red-900" onClick={onRetry}>
            Retry
          </Button>
        </div>
      </div>
    </div>
  );
}

function InsiderEmptyState() {
  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="text-base font-semibold text-slate-900">No suspicious trades yet</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          The scan is live, but nothing has cleared the current threshold yet. Once alerts hit a score of 6 or higher,
          they will appear here automatically.
        </p>
      </CardContent>
    </Card>
  );
}

export function InsiderPageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-9 w-16 rounded-full" />
          ))}
        </div>
      </div>

      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <Skeleton className="mt-4 h-6 w-3/4" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, metricIndex) => (
              <Skeleton key={metricIndex} className="h-12 w-full" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function InsiderPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [clock, setClock] = useState(() => Date.now());

  const state = useMemo(() => parseSearchParams(searchParams), [searchParams]);
  const query = useInsiderAlerts(state);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const updateSearchParams = useCallback(
    (partial: Partial<InsiderControlState>) => {
      const nextState: InsiderControlState = {
        ...state,
        ...partial,
      };

      const next = new URLSearchParams(searchParams.toString());
      next.set("minScore", String(nextState.minScore));
      next.set("limit", String(nextState.limit));

      if (nextState.marketId) {
        next.set("marketId", nextState.marketId);
      } else {
        next.delete("marketId");
      }

      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams, state],
  );

  const onManualRefresh = useCallback(() => {
    void query.refetch();
  }, [query]);

  const lastScanLabel = formatScanLabel(query.data?.lastScannedAt ?? null, clock);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Module 3"
        title="Insider Trading Detection"
        subtitle="Track suspicious Polymarket trades using wallet history, market context, and cumulative scoring."
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Minimum score</p>
            <div className="inline-flex rounded-full border border-slate-200 bg-white p-1">
              {SCORE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => updateSearchParams({ minScore: option })}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition sm:text-sm",
                    option === state.minScore ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100",
                  )}
                >
                  {option}+
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-500">{lastScanLabel}</p>
            {query.isFetching ? (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm font-medium text-slate-600">
                Refreshing...
              </motion.p>
            ) : (
              <button
                type="button"
                onClick={onManualRefresh}
                className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 underline-offset-2 hover:text-slate-950 hover:underline"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </button>
            )}
          </div>
        </div>
      </div>

      {query.isError && !query.data ? <InsiderLoadError message={query.error.message} onRetry={onManualRefresh} /> : null}

      {query.isLoading && !query.data ? <InsiderPageSkeleton /> : null}

      {query.data ? (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="space-y-4"
        >
          <Card>
            <CardContent className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium text-slate-900">
                {query.data.summary.totalAlerts} alerts · {query.data.summary.highScoreAlerts} score 8+ ·{" "}
                {query.data.summary.newWalletAlerts} with new wallet flag
              </p>
              <p className="text-sm text-slate-500">Feed updated {formatRelativeUpdatedAt(query.data.fetchedAt, clock).replace("Updated ", "")}</p>
            </CardContent>
          </Card>

          {query.data.items.length > 0 ? (
            <div className="grid gap-4">
              {query.data.items.map((alert) => (
                <InsiderAlertCard key={alert.tradeId} alert={alert} />
              ))}
            </div>
          ) : (
            <InsiderEmptyState />
          )}
        </motion.div>
      ) : null}
    </div>
  );
}
