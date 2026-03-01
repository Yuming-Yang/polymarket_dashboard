import { Skeleton } from "@/components/ui/skeleton";

export function TopVolumeTableSkeleton() {
  return (
    <div className="hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:block">
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

export function TopVolumeCardsSkeleton() {
  return (
    <div className="grid gap-3 md:hidden">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="mt-3 h-5 w-full" />
          <Skeleton className="mt-2 h-4 w-2/3" />
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
