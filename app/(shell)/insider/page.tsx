import { Suspense } from "react";

import { InsiderPageClient, InsiderPageSkeleton } from "@/components/InsiderPageClient";

export default function InsiderPage() {
  return (
    <Suspense fallback={<InsiderPageSkeleton />}>
      <InsiderPageClient />
    </Suspense>
  );
}
