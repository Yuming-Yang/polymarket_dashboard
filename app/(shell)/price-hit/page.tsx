import { Suspense } from "react";

import { PriceHitPageClient } from "@/components/PriceHitPageClient";

function PriceHitPageFallback() {
  return <div className="min-h-[24rem] animate-pulse rounded-[2rem] border border-slate-200 bg-white/80" />;
}

export default function PriceHitPage() {
  return (
    <Suspense fallback={<PriceHitPageFallback />}>
      <PriceHitPageClient />
    </Suspense>
  );
}
