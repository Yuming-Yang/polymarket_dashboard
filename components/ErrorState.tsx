import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900 shadow-sm">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5" />
        <div>
          <h2 className="text-sm font-semibold">Unable to load top volume data</h2>
          <p className="mt-1 text-sm text-red-800">{message}</p>
          <Button variant="outline" className="mt-4 border-red-200 bg-white text-red-900" onClick={onRetry}>
            Retry
          </Button>
        </div>
      </div>
    </div>
  );
}
