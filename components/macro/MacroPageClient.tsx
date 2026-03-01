"use client";

import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ErrorState } from "@/components/ErrorState";
import { MacroGroupsTable } from "@/components/macro/MacroGroupsTable";
import { MacroKpiStrip } from "@/components/macro/MacroKpiStrip";
import { MacroSummaryPanel } from "@/components/macro/MacroSummaryPanel";
import { PageHeader } from "@/components/PageHeader";
import { TopVolumeTableSkeleton } from "@/components/Skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatRelativeUpdatedAt } from "@/lib/format";
import { MACRO_DEFAULT_LIMIT, MACRO_MAX_LIMIT } from "@/lib/polymarket/macro/types";
import { useMacro } from "@/lib/query/useMacro";
import { useMacroSummary } from "@/lib/query/useMacroSummary";

function parseLimit(searchParams: URLSearchParams): number {
  const limit = Number(searchParams.get("limit") ?? String(MACRO_DEFAULT_LIMIT));

  if (!Number.isFinite(limit)) {
    return MACRO_DEFAULT_LIMIT;
  }

  return Math.min(MACRO_MAX_LIMIT, Math.max(1, Math.round(limit)));
}

export function MacroPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [clock, setClock] = useState(() => Date.now());

  const limit = useMemo(() => parseLimit(searchParams), [searchParams]);
  const query = useMacro({ limit });
  const summaryMutation = useMacroSummary();

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const updateLimit = useCallback(
    (nextLimit: number) => {
      const next = new URLSearchParams(searchParams.toString());
      next.set("limit", String(Math.min(MACRO_MAX_LIMIT, Math.max(1, Math.round(nextLimit)))));
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const onManualRefresh = useCallback(() => {
    void query.refetch();
  }, [query]);

  const onGenerateSummary = useCallback(() => {
    if (!query.data) {
      return;
    }

    summaryMutation.mutate({
      snapshotAt: query.data.fetchedAt,
      items: query.data.items,
      groups: query.data.groups,
      stats: query.data.stats,
    });
  }, [query.data, summaryMutation]);

  const statusLabel = formatRelativeUpdatedAt(query.data?.fetchedAt ?? null, clock);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Module 3"
        title="Macro Monitor"
        subtitle="Economy and Finance markets ranked by 24h volume with CLOB-based 1d and 1w deltas"
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-4 sm:grid-cols-[120px_auto_1fr] sm:items-end">
          <label className="block">
            <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">Limit</span>
            <Input
              value={limit}
              min={1}
              max={MACRO_MAX_LIMIT}
              type="number"
              onChange={(event) => updateLimit(Number(event.target.value) || MACRO_DEFAULT_LIMIT)}
            />
          </label>

          <Button variant="outline" className="h-10" onClick={onManualRefresh}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>

          <div className="flex items-center justify-start sm:justify-end">
            <p className="text-sm text-slate-500">{statusLabel}</p>
          </div>
        </div>
      </div>

      {query.isError && !query.data ? <ErrorState message={query.error.message} onRetry={onManualRefresh} /> : null}

      {query.isLoading && !query.data ? <TopVolumeTableSkeleton /> : null}

      {query.data ? (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="space-y-6"
        >
          <MacroKpiStrip stats={query.data.stats} />
          <MacroGroupsTable items={query.data.items} groups={query.data.groups} />
          <MacroSummaryPanel
            hasSnapshot={Boolean(query.data)}
            isGenerating={summaryMutation.isPending}
            errorMessage={summaryMutation.isError ? summaryMutation.error.message : null}
            summary={summaryMutation.data ?? null}
            onGenerate={onGenerateSummary}
          />
        </motion.div>
      ) : null}
    </div>
  );
}
