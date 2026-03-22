import { Suspense } from "react";

import { TopVolumePageClient } from "@/components/TopVolumePageClient";
import { TopVolumeCardsSkeleton, TopVolumeTableSkeleton } from "@/components/Skeletons";

function TopVolumePageFallback() {
  return (
    <div className="space-y-4">
      <TopVolumeTableSkeleton />
      <TopVolumeCardsSkeleton />
    </div>
  );
}

export default function TrendingPage() {
  return (
    <Suspense fallback={<TopVolumePageFallback />}>
      <TopVolumePageClient />
    </Suspense>
  );
}
