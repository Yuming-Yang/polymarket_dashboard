"use client";

import { motion } from "framer-motion";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ErrorState } from "@/components/ErrorState";
import { PageHeader } from "@/components/PageHeader";
import { TopVolumeCards } from "@/components/TopVolumeCards";
import { TopVolumeControlState, TopVolumeControls } from "@/components/TopVolumeControls";
import { TopVolumeTable } from "@/components/TopVolumeTable";
import { TopVolumeCardsSkeleton, TopVolumeTableSkeleton } from "@/components/Skeletons";
import { formatRelativeUpdatedAt } from "@/lib/format";
import { parseTagCsv } from "@/lib/polymarket/filter";
import { useTopVolume } from "@/lib/query/useTopVolume";

function parseSearchParams(searchParams: URLSearchParams): TopVolumeControlState {
  const entityParam = searchParams.get("entity");
  const windowParam = searchParams.get("window");
  const limitParam = searchParams.get("limit");

  const parsedLimit = Number(limitParam ?? "10");

  return {
    entity: entityParam === "events" ? "events" : "markets",
    window: windowParam === "total" ? "total" : "24h",
    limit: Number.isFinite(parsedLimit) ? Math.min(100, Math.max(1, Math.round(parsedLimit))) : 10,
    includeTags: searchParams.get("includeTags") ?? "",
    excludeTags: searchParams.get("excludeTags") ?? "",
  };
}

export function TopVolumePageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [clock, setClock] = useState(() => Date.now());

  const state = useMemo(() => parseSearchParams(searchParams), [searchParams]);

  const query = useTopVolume({
    entity: state.entity,
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
    (partial: Partial<TopVolumeControlState>) => {
      const nextState: TopVolumeControlState = {
        ...state,
        ...partial,
      };

      const next = new URLSearchParams(searchParams.toString());
      next.set("entity", nextState.entity);
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
        eyebrow="Module 1"
        title="Trending"
        subtitle="Track the highest-volume Polymarket markets and events"
      />

      <TopVolumeControls
        state={state}
        onChange={updateSearchParams}
        onRefresh={onManualRefresh}
        isRefreshing={query.isFetching}
      />

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
        ) : null}
      </div>

      {query.isError && !query.data ? (
        <ErrorState message={query.error.message} onRetry={onManualRefresh} />
      ) : null}

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
          <TopVolumeTable items={query.data.items} window={state.window} />
          <TopVolumeCards items={query.data.items} window={state.window} />
        </motion.div>
      ) : null}
    </div>
  );
}
