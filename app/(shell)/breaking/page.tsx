import { Suspense } from "react";

import { BreakingPageClient } from "@/components/BreakingPageClient";
import { TopVolumeCardsSkeleton, TopVolumeTableSkeleton } from "@/components/Skeletons";

function BreakingPageFallback() {
  return (
    <div className="space-y-4">
      <TopVolumeTableSkeleton />
      <TopVolumeCardsSkeleton />
    </div>
  );
}

export default function BreakingPage() {
  return (
    <Suspense fallback={<BreakingPageFallback />}>
      <BreakingPageClient />
    </Suspense>
  );
}
