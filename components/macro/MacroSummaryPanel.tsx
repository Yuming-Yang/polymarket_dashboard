import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MacroSummaryResponse } from "@/lib/polymarket/macro/types";

type MacroSummaryPanelProps = {
  hasSnapshot: boolean;
  isGenerating: boolean;
  errorMessage: string | null;
  summary: MacroSummaryResponse | null;
  onGenerate: () => void;
};

export function MacroSummaryPanel({
  hasSnapshot,
  isGenerating,
  errorMessage,
  summary,
  onGenerate,
}: MacroSummaryPanelProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-4 w-4" />
              AI Summary
            </CardTitle>
            <CardDescription>
              Generate a narrative summary of the current grouped macro snapshot.
            </CardDescription>
          </div>
          <Button onClick={onGenerate} disabled={!hasSnapshot || isGenerating}>
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Generate AI Summary
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {errorMessage ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorMessage}</p> : null}

        {!summary ? (
          <p className="text-sm text-slate-500">
            {hasSnapshot ? "No summary yet. Click the button to generate one." : "Waiting for snapshot data..."}
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Generated at {new Date(summary.generatedAt).toLocaleString()} • model {summary.model}
            </p>

            <div>
              <h3 className="text-sm font-semibold text-slate-900">Takeaway</h3>
              <p className="mt-1 text-sm text-slate-700">{summary.summary.takeaway}</p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-900">Top Recent Changes</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {summary.summary.topRecentChanges.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-900">Group Highlights</h3>
              <ul className="mt-1 space-y-1 text-sm text-slate-700">
                {summary.summary.groupHighlights.map((item) => (
                  <li key={`${item.group}-${item.note}`}>
                    <span className="font-medium text-slate-900">{item.group}:</span> {item.note}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-900">Watch Items</h3>
              <ul className="mt-1 space-y-1 text-sm text-slate-700">
                {summary.summary.watchItems.map((item) => (
                  <li key={`${item.title}-${item.reason}`}>
                    <span className="font-medium text-slate-900">{item.title}:</span> {item.reason}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
