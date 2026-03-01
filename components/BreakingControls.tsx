"use client";

import type { ChangeEvent } from "react";

import { Input } from "@/components/ui/input";
import { TAG_OPTIONS } from "@/lib/polymarket/tag-options";
import { cn } from "@/lib/utils";

export type BreakingControlState = {
  window: "1h" | "24h" | "7d";
  limit: number;
  includeTags: string[];
  excludeTags: string[];
};

type BreakingControlsProps = {
  state: BreakingControlState;
  onChange: (next: Partial<BreakingControlState>) => void;
};

const windowOptions: Array<{ label: string; value: BreakingControlState["window"] }> = [
  { label: "1h", value: "1h" },
  { label: "24h", value: "24h" },
  { label: "7d", value: "7d" },
];

export function BreakingControls({ state, onChange }: BreakingControlsProps) {
  const onSelectTags = (
    event: ChangeEvent<HTMLSelectElement>,
    key: "includeTags" | "excludeTags",
  ) => {
    const selected = Array.from(event.currentTarget.selectedOptions).map((option) => option.value);
    onChange({ [key]: selected });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="grid gap-4 lg:grid-cols-[auto_96px_1fr_1fr] lg:items-end">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Window</p>
          <div className="inline-flex rounded-full border border-slate-200 bg-white p-1">
            {windowOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange({ window: option.value })}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition sm:text-sm",
                  option.value === state.window ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">Limit</span>
          <Input
            value={state.limit}
            min={1}
            max={100}
            type="number"
            onChange={(event) => onChange({ limit: Number(event.target.value) || 20 })}
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">Include tags</span>
          <select
            multiple
            value={state.includeTags}
            onChange={(event) => onSelectTags(event, "includeTags")}
            className="h-24 w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {TAG_OPTIONS.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">Exclude tags</span>
          <select
            multiple
            value={state.excludeTags}
            onChange={(event) => onSelectTags(event, "excludeTags")}
            className="h-24 w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {TAG_OPTIONS.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
