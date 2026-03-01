"use client";

import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Entity = "markets" | "events";
type Window = "24h" | "total";

export type TopVolumeControlState = {
  entity: Entity;
  window: Window;
  limit: number;
  includeTags: string;
  excludeTags: string;
};

type TopVolumeControlsProps = {
  state: TopVolumeControlState;
  onChange: (next: Partial<TopVolumeControlState>) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
};

const entityOptions: Array<{ label: string; value: Entity }> = [
  { label: "Markets", value: "markets" },
  { label: "Events", value: "events" },
];

const windowOptions: Array<{ label: string; value: Window }> = [
  { label: "24h", value: "24h" },
  { label: "Total", value: "total" },
];

function SegmentedControl<T extends string>({
  value,
  options,
  onSelect,
}: {
  value: T;
  options: Array<{ label: string; value: T }>;
  onSelect: (next: T) => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-slate-200 bg-white p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onSelect(option.value)}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium transition sm:text-sm",
            option.value === value ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function TopVolumeControls({ state, onChange, onRefresh, isRefreshing }: TopVolumeControlsProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="grid gap-4 lg:grid-cols-[auto_auto_96px_1fr_1fr_auto] lg:items-end">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Entity</p>
          <SegmentedControl value={state.entity} options={entityOptions} onSelect={(entity) => onChange({ entity })} />
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Volume Window</p>
          <SegmentedControl value={state.window} options={windowOptions} onSelect={(window) => onChange({ window })} />
        </div>

        <label className="block">
          <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">Limit</span>
          <Input
            value={state.limit}
            min={1}
            max={100}
            type="number"
            onChange={(event) => onChange({ limit: Number(event.target.value) || 10 })}
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">Include tags</span>
          <Input
            value={state.includeTags}
            placeholder="politics, crypto prices"
            onChange={(event) => onChange({ includeTags: event.target.value })}
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">Exclude tags</span>
          <Input
            value={state.excludeTags}
            placeholder="sports"
            onChange={(event) => onChange({ excludeTags: event.target.value })}
          />
        </label>

        <Button variant="outline" className="h-10" onClick={onRefresh} aria-label="Refresh data">
          <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>
    </div>
  );
}
