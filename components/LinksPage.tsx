import { ExternalLink } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { ecosystemTools, officialDashboards } from "@/lib/links/resources";
import type { OfficialDashboardPreview as OfficialDashboardPreviewKey } from "@/lib/links/resources";
import { cn } from "@/lib/utils";

function SectionHeader({
  id,
  eyebrow,
  title,
  subtitle,
}: {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{eyebrow}</p>
      <div className="space-y-1">
        <h2 id={id} className="text-2xl font-semibold tracking-tight text-slate-950">
          {title}
        </h2>
        <p className="max-w-3xl text-sm text-slate-600 sm:text-base">{subtitle}</p>
      </div>
    </div>
  );
}

function PreviewFrame({
  variant,
  children,
}: {
  variant: OfficialDashboardPreviewKey;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative h-52 overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#08111d] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        variant === "fed-rates" &&
          "bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.12),_transparent_38%),linear-gradient(180deg,_#0a1726_0%,_#08111d_100%)]",
        variant === "macro" &&
          "bg-[radial-gradient(circle_at_15%_20%,_rgba(34,197,94,0.16),_transparent_30%),radial-gradient(circle_at_85%_15%,_rgba(59,130,246,0.18),_transparent_26%),linear-gradient(180deg,_#091421_0%,_#07101a_100%)]",
        variant === "global-elections" &&
          "bg-[radial-gradient(circle_at_top_left,_rgba(96,165,250,0.16),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.14),_transparent_34%),linear-gradient(180deg,_#0a1525_0%,_#09111d_100%)]",
      )}
    >
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.07)_1px,transparent_1px)] bg-[size:3.75rem_3rem]" />
      <div className="absolute inset-4 rounded-[1.4rem] border border-white/8 bg-slate-950/20" />
      <div className="relative h-full w-full">{children}</div>
    </div>
  );
}

function FedRatesPreview() {
  const barHeights = ["h-24", "h-24", "h-[4.5rem]", "h-[4.5rem]", "h-12"] as const;
  const lineSegments = [
    "left-[14%] top-[39%] w-[16%] rotate-[7deg]",
    "left-[29%] top-[37%] w-[15%] rotate-0",
    "left-[44%] top-[45%] w-[14%] -rotate-[14deg]",
    "left-[58%] top-[45%] w-[13%] rotate-0",
    "left-[71%] top-[52%] w-[13%] -rotate-[14deg]",
  ] as const;

  return (
    <PreviewFrame variant="fed-rates">
      <div className="absolute left-7 right-7 top-6 flex items-center justify-between text-[0.65rem] font-medium uppercase tracking-[0.24em] text-sky-100/70">
        <span>Rates Path</span>
        <span>Probability Curve</span>
      </div>

      <div className="absolute inset-x-7 bottom-7 top-14 rounded-[1.35rem] border border-white/8 bg-white/[0.02]" />

      <div className="absolute inset-x-10 bottom-12 flex items-end gap-2">
        {barHeights.map((heightClass, index) => (
          <div
            key={index}
            className={cn(
              "flex-1 rounded-t-2xl border border-sky-300/20 bg-gradient-to-t from-sky-400/14 to-cyan-200/28 shadow-[0_0_30px_rgba(56,189,248,0.08)]",
              heightClass,
            )}
          />
        ))}
      </div>

      <div className="absolute inset-x-10 top-[44%] h-16">
        {lineSegments.map((segmentClass, index) => (
          <div
            key={index}
            className={cn("absolute h-[2px] rounded-full bg-cyan-200/90 shadow-[0_0_12px_rgba(165,243,252,0.45)]", segmentClass)}
          />
        ))}
        {[14, 30, 44, 58, 71, 84].map((left, index) => (
          <div
            key={index}
            className="absolute h-2.5 w-2.5 -translate-x-1/2 rounded-full border border-cyan-100/40 bg-cyan-200 shadow-[0_0_16px_rgba(125,211,252,0.6)]"
            style={{ left: `${left}%`, top: index < 2 ? "8%" : index < 4 ? "32%" : "58%" }}
          />
        ))}
      </div>
    </PreviewFrame>
  );
}

function MacroPreview() {
  const barHeights = ["h-16", "h-24", "h-14", "h-28", "h-20", "h-32"] as const;
  const sparkline = [
    "left-[12%] top-[59%]",
    "left-[26%] top-[44%]",
    "left-[40%] top-[51%]",
    "left-[54%] top-[31%]",
    "left-[68%] top-[39%]",
    "left-[82%] top-[23%]",
  ] as const;

  return (
    <PreviewFrame variant="macro">
      <div className="absolute left-7 right-7 top-6 flex items-center justify-between text-[0.65rem] font-medium uppercase tracking-[0.24em] text-emerald-100/70">
        <span>Macro Pulse</span>
        <span>Cross Asset</span>
      </div>

      <div className="absolute left-8 top-16 h-20 w-20 rounded-full border border-emerald-200/15 bg-emerald-300/5 shadow-[0_0_50px_rgba(34,197,94,0.12)]" />
      <div className="absolute left-12 top-20 h-12 w-12 rounded-full border border-emerald-200/20" />
      <div className="absolute right-10 top-[4.5rem] h-14 w-24 rounded-[1.25rem] border border-blue-200/15 bg-blue-300/8 px-4 py-3">
        <div className="h-2 w-12 rounded-full bg-blue-100/40" />
        <div className="mt-3 h-2 w-16 rounded-full bg-blue-100/20" />
        <div className="mt-2 h-2 w-10 rounded-full bg-blue-100/30" />
      </div>

      <div className="absolute inset-x-10 bottom-8 flex items-end gap-2">
        {barHeights.map((heightClass, index) => (
          <div
            key={index}
            className={cn(
              "flex-1 rounded-t-xl border border-white/10 bg-gradient-to-t from-blue-400/18 to-emerald-200/20",
              heightClass,
            )}
          />
        ))}
      </div>

      <div className="absolute inset-x-10 top-[26%] h-24">
        {sparkline.slice(0, -1).map((pointClass, index) => (
          <div
            key={index}
            className={cn("absolute h-[2px] origin-left rounded-full bg-emerald-200/80 shadow-[0_0_12px_rgba(134,239,172,0.35)]", pointClass)}
            style={{ width: "14%", transform: index % 2 === 0 ? "rotate(-18deg)" : "rotate(12deg)" }}
          />
        ))}
        {sparkline.map((pointClass, index) => (
          <div
            key={index}
            className={cn("absolute h-2.5 w-2.5 rounded-full border border-emerald-100/30 bg-emerald-200", pointClass)}
          />
        ))}
      </div>
    </PreviewFrame>
  );
}

function GlobalElectionsPreview() {
  const dotPositions = [
    "left-[16%] top-[28%]",
    "left-[24%] top-[38%]",
    "left-[34%] top-[24%]",
    "left-[45%] top-[34%]",
    "left-[54%] top-[26%]",
    "left-[65%] top-[40%]",
    "left-[76%] top-[28%]",
    "left-[69%] top-[18%]",
  ] as const;

  const ballotColumns = [
    "h-[4.5rem]",
    "h-24",
    "h-[7.5rem]",
    "h-20",
  ] as const;

  return (
    <PreviewFrame variant="global-elections">
      <div className="absolute left-7 right-7 top-6 flex items-center justify-between text-[0.65rem] font-medium uppercase tracking-[0.24em] text-sky-100/70">
        <span>Election Map</span>
        <span>Ballot Flow</span>
      </div>

      <div className="absolute left-8 top-14 h-24 w-44 rounded-[1.5rem] border border-white/10 bg-white/[0.03]" />
      {dotPositions.map((position, index) => (
        <div
          key={index}
          className={cn(
            "absolute h-3 w-3 rounded-full border border-sky-100/25 shadow-[0_0_16px_rgba(96,165,250,0.28)]",
            position,
            index % 3 === 0 ? "bg-sky-300/80" : index % 3 === 1 ? "bg-blue-200/70" : "bg-cyan-200/80",
          )}
        />
      ))}
      <div className="absolute left-12 top-[48%] h-[1px] w-28 bg-gradient-to-r from-transparent via-sky-200/45 to-transparent" />

      <div className="absolute bottom-9 right-9 flex items-end gap-3 rounded-[1.5rem] border border-white/10 bg-white/[0.03] px-5 py-4">
        {ballotColumns.map((heightClass, index) => (
          <div key={index} className="flex flex-col items-center gap-2">
            <div className={cn("w-8 rounded-t-xl border border-sky-200/20 bg-gradient-to-t from-sky-400/18 to-blue-200/30", heightClass)} />
            <div className="h-2 w-8 rounded-full bg-sky-100/20" />
          </div>
        ))}
      </div>
    </PreviewFrame>
  );
}

function OfficialDashboardArtwork({ variant }: { variant: OfficialDashboardPreviewKey }) {
  if (variant === "fed-rates") {
    return <FedRatesPreview />;
  }

  if (variant === "macro") {
    return <MacroPreview />;
  }

  return <GlobalElectionsPreview />;
}

export function LinksPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Module 6"
        title="Links"
        subtitle="Curated dashboards and ecosystem tools for Polymarket research."
      />

      <section className="space-y-5" aria-labelledby="official-dashboards-heading">
        <SectionHeader
          id="official-dashboards-heading"
          eyebrow="Section 1"
          title="Polymarket Official Dashboards"
          subtitle="Three first-party dashboards worth keeping open alongside the live market."
        />

        <ul aria-label="Polymarket official dashboards" className="grid gap-4 xl:grid-cols-3">
          {officialDashboards.map((dashboard) => (
            <li key={dashboard.name} className="list-none">
              <Card className="h-full overflow-hidden border-slate-200/90 bg-white/95">
                <div className="p-4 pb-0">
                  <OfficialDashboardArtwork variant={dashboard.preview} />
                </div>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Official Dashboard</p>
                      <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">{dashboard.name}</h3>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                      Preview
                    </span>
                  </div>

                  <a
                    href={dashboard.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${dashboard.name}`}
                    className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-slate-700 transition hover:text-slate-950"
                  >
                    <span className="font-mono text-xs text-slate-500 sm:text-sm">{dashboard.displayUrl}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  </a>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-5" aria-labelledby="ecosystem-tools-heading">
        <SectionHeader
          id="ecosystem-tools-heading"
          eyebrow="Section 2"
          title="Ecosystem Tools"
          subtitle="Third-party analytics, alerting, and research tools across the wider prediction-market stack."
        />

        <Card className="overflow-hidden border-slate-200/90 bg-white/95">
          <CardContent className="p-0">
            <ol aria-label="Ecosystem tools" className="divide-y divide-slate-200/80">
              {ecosystemTools.map((tool, index) => (
                <li key={tool.name} className="list-none px-5 py-5 sm:px-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 gap-4">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 font-mono text-xs font-medium text-slate-500">
                        {String(index + 1).padStart(2, "0")}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-lg font-semibold tracking-tight text-slate-950">{tool.name}</h3>
                        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600 sm:text-base">{tool.description}</p>
                      </div>
                    </div>

                    <a
                      href={tool.href}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Open ${tool.name}`}
                      className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 transition hover:text-slate-950 lg:shrink-0"
                    >
                      <span className="font-mono text-xs text-slate-500 sm:text-sm">{tool.displayUrl}</span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    </a>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
