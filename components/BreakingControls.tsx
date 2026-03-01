"use client";

import { MultiSelectDropdown } from "@/components/ui/multi-select-dropdown";
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
          <MultiSelectDropdown
            label="Include tags"
            options={TAG_OPTIONS}
            selected={state.includeTags}
            onChange={(includeTags) => onChange({ includeTags })}
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">Exclude tags</span>
          <MultiSelectDropdown
            label="Exclude tags"
            options={TAG_OPTIONS}
            selected={state.excludeTags}
            onChange={(excludeTags) => onChange({ excludeTags })}
          />
        </label>
      </div>
    </div>
  );
}
