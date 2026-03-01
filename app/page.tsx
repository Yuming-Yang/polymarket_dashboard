import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center px-6 py-20">
      <div className="w-full max-w-2xl rounded-3xl border border-border bg-card p-10 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Polymarket Analytics</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground">Polymarket analytics</h1>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/top-volume"
            className="inline-flex items-center rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-900 transition hover:border-slate-900"
          >
            Trending
          </Link>
          <Link
            href="/breaking"
            className="inline-flex items-center rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-900 transition hover:border-slate-900"
          >
            Breaking
          </Link>
        </div>
      </div>
    </main>
  );
}
