import Link from "next/link";

import { Separator } from "@/components/ui/separator";

export function Nav() {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-slate-50/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm font-semibold tracking-tight text-slate-900">
            Polymarket Analytics
          </Link>
          <Separator orientation="vertical" className="h-5" />
          <nav className="flex items-center gap-2 text-sm">
            <Link
              href="/top-volume"
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-800 transition hover:border-slate-900"
            >
              Trending
            </Link>
            <Link
              href="/breaking"
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-800 transition hover:border-slate-900"
            >
              Breaking
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
