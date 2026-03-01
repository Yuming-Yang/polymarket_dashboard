"use client";

import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { ErrorState } from "@/components/ErrorState";
import { MacroGroupsTable } from "@/components/macro/MacroGroupsTable";
import { MacroSummaryPanel } from "@/components/macro/MacroSummaryPanel";
import { PageHeader } from "@/components/PageHeader";
import { TopVolumeTableSkeleton } from "@/components/Skeletons";
import { Button } from "@/components/ui/button";
import { formatRelativeUpdatedAt } from "@/lib/format";
import { useMacro } from "@/lib/query/useMacro";
import { useMacroSummary } from "@/lib/query/useMacroSummary";

export function MacroPageClient() {
  const [clock, setClock] = useState(() => Date.now());

  const query = useMacro();
  const summaryMutation = useMacroSummary();

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

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
        <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-end">
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
          <MacroSummaryPanel
            hasSnapshot={Boolean(query.data)}
            isGenerating={summaryMutation.isPending}
            errorMessage={summaryMutation.isError ? summaryMutation.error.message : null}
            summary={summaryMutation.data ?? null}
            onGenerate={onGenerateSummary}
          />
          <MacroGroupsTable items={query.data.items} groups={query.data.groups} />
        </motion.div>
      ) : null}
    </div>
  );
}
