"use client";

import { motion } from "framer-motion";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { BreakingCards } from "@/components/BreakingCards";
import { BreakingControlState, BreakingControls } from "@/components/BreakingControls";
import { BreakingTable } from "@/components/BreakingTable";
import { ErrorState } from "@/components/ErrorState";
import { PageHeader } from "@/components/PageHeader";
import { TopVolumeCardsSkeleton, TopVolumeTableSkeleton } from "@/components/Skeletons";
import { formatRelativeUpdatedAt } from "@/lib/format";
import { parseTagCsv } from "@/lib/polymarket/filter";
import { useBreaking } from "@/lib/query/useBreaking";

function parseSearchParams(searchParams: URLSearchParams): BreakingControlState {
  const windowParam = searchParams.get("window");
  const limitParam = searchParams.get("limit");
  const parsedLimit = Number(limitParam ?? "20");

  return {
    window: windowParam === "1h" || windowParam === "7d" ? windowParam : "24h",
    limit: Number.isFinite(parsedLimit) ? Math.min(100, Math.max(1, Math.round(parsedLimit))) : 20,
    includeTags: searchParams.get("includeTags") ?? "",
    excludeTags: searchParams.get("excludeTags") ?? "",
  };
}

export function BreakingPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [clock, setClock] = useState(() => Date.now());

  const state = useMemo(() => parseSearchParams(searchParams), [searchParams]);

  const query = useBreaking({
    window: state.window,
    limit: state.limit,
    includeTags: parseTagCsv(state.includeTags),
    excludeTags: parseTagCsv(state.excludeTags),
  });

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const updateSearchParams = useCallback(
    (partial: Partial<BreakingControlState>) => {
      const nextState: BreakingControlState = {
        ...state,
        ...partial,
      };

      const next = new URLSearchParams(searchParams.toString());
      next.set("window", nextState.window);
      next.set("limit", String(nextState.limit));

      if (nextState.includeTags.trim().length > 0) {
        next.set("includeTags", nextState.includeTags);
      } else {
        next.delete("includeTags");
      }

      if (nextState.excludeTags.trim().length > 0) {
        next.set("excludeTags", nextState.excludeTags);
      } else {
        next.delete("excludeTags");
      }

      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams, state],
  );

  const onManualRefresh = useCallback(() => {
    void query.refetch();
  }, [query]);

  const statusLabel = formatRelativeUpdatedAt(query.data?.fetchedAt ?? null, clock);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Module 2"
        title="Breaking"
        subtitle="Find markets with the largest absolute price movement over your selected window, using the notebook section 5 movers pattern."
      />

      <BreakingControls state={state} onChange={updateSearchParams} />

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{statusLabel}</p>
        {query.isFetching ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm font-medium text-slate-600"
          >
            Refreshing...
          </motion.p>
        ) : (
          <button
            type="button"
            onClick={onManualRefresh}
            className="text-sm font-medium text-slate-700 underline-offset-2 hover:text-slate-950 hover:underline"
          >
            Refresh
          </button>
        )}
      </div>

      {query.isError && !query.data ? <ErrorState message={query.error.message} onRetry={onManualRefresh} /> : null}

      {query.isLoading && !query.data ? (
        <>
          <TopVolumeTableSkeleton />
          <TopVolumeCardsSkeleton />
        </>
      ) : null}

      {query.data ? (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="space-y-4"
        >
          <BreakingTable items={query.data.items} window={state.window} />
          <BreakingCards items={query.data.items} window={state.window} />
        </motion.div>
      ) : null}
    </div>
  );
}
