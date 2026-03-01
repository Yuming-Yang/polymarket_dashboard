import { Suspense } from "react";

import { MacroPageClient } from "@/components/macro/MacroPageClient";
import { TopVolumeTableSkeleton } from "@/components/Skeletons";

function MacroPageFallback() {
  return <TopVolumeTableSkeleton />;
}

export default function MacroPage() {
  return (
    <Suspense fallback={<MacroPageFallback />}>
      <MacroPageClient />
    </Suspense>
  );
}
