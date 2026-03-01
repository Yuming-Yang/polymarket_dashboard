"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type MultiSelectDropdownProps = {
  label: string;
  options: readonly string[];
  selected: string[];
  onChange: (next: string[]) => void;
};

function summarizeSelection(selected: string[]) {
  if (selected.length === 0) {
    return "Any tags";
  }

  if (selected.length <= 2) {
    return selected.join(", ");
  }

  return `${selected.slice(0, 2).join(", ")} +${selected.length - 2}`;
}

export function MultiSelectDropdown({ label, options, selected, onChange }: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  const normalizedSearch = search.trim().toLowerCase();

  const filteredOptions = useMemo(() => {
    if (!normalizedSearch) {
      return options;
    }

    return options.filter((option) => option.toLowerCase().includes(normalizedSearch));
  }, [options, normalizedSearch]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const toggleOption = (option: string) => {
    if (selectedSet.has(option)) {
      onChange(selected.filter((value) => value !== option));
      return;
    }

    onChange([...selected, option]);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={`${label} selector`}
        onClick={() => setIsOpen((open) => !open)}
        className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="truncate">{summarizeSelection(selected)}</span>
        <ChevronDown className="h-4 w-4 text-slate-500" />
      </button>

      {isOpen ? (
        <div className="absolute z-30 mt-2 w-full min-w-[260px] rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-xs font-medium text-slate-500 hover:text-slate-900"
            >
              Clear
            </button>
          </div>

          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search tags"
            className="mb-2 h-9 w-full rounded-md border border-slate-200 px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />

          <div className="max-h-56 overflow-y-auto rounded-md border border-slate-100">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const isChecked = selectedSet.has(option);

                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => toggleOption(option)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
                  >
                    <span>{option}</span>
                    {isChecked ? <Check className="h-4 w-4 text-slate-900" /> : null}
                  </button>
                );
              })
            ) : (
              <p className="px-3 py-2 text-sm text-slate-500">No tags found</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
