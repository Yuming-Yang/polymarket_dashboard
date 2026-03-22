"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AlertTriangle, ExternalLink, RefreshCw, Search, Sparkles } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatProbability, formatRelativeUpdatedAt, formatUsd } from "@/lib/format";
import { WatchlistEventItem, WatchlistMarketItem } from "@/lib/polymarket/types";
import { useWatchlist } from "@/lib/query/useWatchlist";
import { cn } from "@/lib/utils";

const DEFAULT_LIMIT = 12;
const SAVED_KEYWORDS = ["Fed", "AI", "Trump", "Iran", "Bitcoin", "Crypto", "Largest Company"] as const;

function WatchlistErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900 shadow-sm">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5" />
        <div>
          <h2 className="text-sm font-semibold">Unable to load watchlist results</h2>
          <p className="mt-1 text-sm text-red-800">{message}</p>
          <Button variant="outline" className="mt-4 border-red-200 bg-white text-red-900" onClick={onRetry}>
            Retry
          </Button>
        </div>
      </div>
    </div>
  );
}

function WatchlistLoadingState() {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-11/12" />
          <Skeleton className="h-5 w-4/5" />
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-4 w-40" />
                </div>
                <Skeleton className="h-10 w-24" />
              </div>
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, marketIndex) => (
                  <div key={marketIndex} className="rounded-2xl border border-slate-200 p-4">
                    <Skeleton className="h-5 w-5/6" />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Skeleton className="h-10 w-28 rounded-full" />
                      <Skeleton className="h-10 w-28 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function WatchlistEmptyResults({ query }: { query: string }) {
  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="text-base font-semibold text-slate-900">No events found</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          No active Polymarket events matched <span className="font-medium text-slate-900">&quot;{query}&quot;</span>. Try a broader topic or
          one of the quick buttons above.
        </p>
      </CardContent>
    </Card>
  );
}

function ProbabilityPill({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number | null;
  tone?: "default" | "positive" | "negative";
}) {
  return (
    <div
      className={cn(
        "rounded-full border px-3 py-2 text-sm",
        tone === "positive" && "border-emerald-200 bg-emerald-50 text-emerald-900",
        tone === "negative" && "border-rose-200 bg-rose-50 text-rose-900",
        tone === "default" && "border-slate-200 bg-slate-50 text-slate-800",
      )}
    >
      <span className="mr-2 text-xs uppercase tracking-wide text-slate-500">{label}</span>
      <span className="font-semibold">{formatProbability(value)}</span>
    </div>
  );
}

function ProbabilityCluster({ item }: { item: WatchlistMarketItem }) {
  if (item.yesPrice !== null || item.noPrice !== null) {
    return (
      <>
        {item.yesPrice !== null ? <ProbabilityPill label="Yes" value={item.yesPrice} tone="positive" /> : null}
        {item.noPrice !== null ? <ProbabilityPill label="No" value={item.noPrice} tone="negative" /> : null}
      </>
    );
  }

  if (item.lastTradePrice !== null) {
    return <ProbabilityPill label="Probability" value={item.lastTradePrice} />;
  }

  return <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">Price unavailable</div>;
}

function WatchlistMarketRow({ item }: { item: WatchlistMarketItem }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <h4 className="text-base font-semibold tracking-tight text-slate-900">{item.title}</h4>
          <div className="mt-3 flex flex-wrap gap-2">
            <ProbabilityCluster item={item} />
            <div className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              <span className="mr-2 text-xs uppercase tracking-wide text-slate-500">24h Volume</span>
              <span className="font-semibold">{formatUsd(item.volume24hUsd)}</span>
            </div>
          </div>
        </div>

        {item.url ? (
          <Link
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-950"
          >
            Open market
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function WatchlistEventCard({ event, index }: { event: WatchlistEventItem; index: number }) {
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">#{index + 1}</p>
            <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">{event.title}</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              <div className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                <span className="mr-2 text-xs uppercase tracking-wide text-slate-500">Markets</span>
                <span className="font-semibold">{event.marketCount}</span>
              </div>
              <div className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                <span className="mr-2 text-xs uppercase tracking-wide text-slate-500">24h Volume</span>
                <span className="font-semibold">{formatUsd(event.volume24hUsd)}</span>
              </div>
            </div>
          </div>

          {event.url ? (
            <Link
              href={event.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-950"
            >
              Open event
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          ) : null}
        </div>

        <div className="grid gap-3">
          {event.markets.map((market) => (
            <WatchlistMarketRow key={market.id} item={market} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function WatchlistPageClient() {
  const [draftQuery, setDraftQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [clock, setClock] = useState(() => Date.now());
  const query = useWatchlist({
    query: activeQuery,
    limit: DEFAULT_LIMIT,
  });

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const runSearch = useCallback(
    (nextQuery: string) => {
      const normalizedQuery = nextQuery.trim();

      if (!normalizedQuery) {
        return;
      }

      if (normalizedQuery === activeQuery) {
        void query.refetch();
        return;
      }

      setActiveQuery(normalizedQuery);
    },
    [activeQuery, query],
  );

  const onSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      runSearch(draftQuery);
    },
    [draftQuery, runSearch],
  );

  const onChipClick = useCallback(
    (keyword: (typeof SAVED_KEYWORDS)[number]) => {
      setDraftQuery(keyword);
      runSearch(keyword);
    },
    [runSearch],
  );

  const onRetry = useCallback(() => {
    if (activeQuery) {
      void query.refetch();
    }
  }, [activeQuery, query]);

  const hasActiveSearch = activeQuery.trim().length > 0;
  const statusLabel = formatRelativeUpdatedAt(query.data?.fetchedAt ?? null, clock);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Module 4"
        title="Search"
        subtitle="Search a topic, pull the most relevant live Polymarket markets, and read the market narrative in one place."
      />

      <Card className="border-slate-200/80 bg-white/95">
        <CardContent className="p-5 sm:p-6">
          <form role="search" onSubmit={onSubmit} className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input
                value={draftQuery}
                onChange={(event) => setDraftQuery(event.target.value)}
                placeholder="Search key words"
                className="h-14 rounded-2xl border-slate-200 pl-12 pr-4 text-base"
                aria-label="Search topics"
              />
            </div>
            <Button type="submit" size="lg" className="h-14 rounded-2xl px-6" disabled={draftQuery.trim().length === 0 || (query.isLoading && !query.data)}>
              {query.isLoading && !query.data ? "Searching..." : "Search"}
            </Button>
          </form>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {SAVED_KEYWORDS.map((keyword) => (
              <button
                key={keyword}
                type="button"
                onClick={() => onChipClick(keyword)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm font-medium transition",
                  activeQuery === keyword
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-900 hover:text-slate-950",
                )}
              >
                {keyword}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {hasActiveSearch ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Current topic</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">&quot;{activeQuery}&quot;</h2>
          </div>

          <div className="flex items-center gap-3">
            {query.data ? <p className="text-sm text-slate-500">{statusLabel}</p> : null}
            {query.isFetching && query.data ? (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm font-medium text-slate-600">
                Refreshing...
              </motion.p>
            ) : query.data ? (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 underline-offset-2 hover:text-slate-950 hover:underline"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {query.isError && !query.data ? <WatchlistErrorState message={query.error.message} onRetry={onRetry} /> : null}

      {query.isLoading && !query.data ? <WatchlistLoadingState /> : null}

      {query.data ? (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="space-y-4"
        >
          {query.data.events.length > 0 && query.data.summary ? (
            <Card className="border-slate-900/10 bg-slate-950 text-white shadow-lg shadow-slate-900/5">
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 h-5 w-5 text-cyan-300" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-300">AI Summary</p>
                    <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-100 sm:text-base">{query.data.summary}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {query.data.events.length > 0 && query.data.summaryStatus === "unavailable" ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 shadow-sm">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5" />
                <div>
                  <p className="text-sm font-semibold">AI summary unavailable right now</p>
                  <p className="mt-1 text-sm text-amber-800">The market list is still live. Try refreshing in a moment if you want a new narrative read.</p>
                </div>
              </div>
            </div>
          ) : null}

          {query.data.events.length === 0 ? (
            <WatchlistEmptyResults query={activeQuery} />
          ) : (
            <div className="grid gap-3">
              {query.data.events.map((event, index) => (
                <WatchlistEventCard key={event.id} event={event} index={index} />
              ))}
            </div>
          )}
        </motion.div>
      ) : null}
    </div>
  );
}
