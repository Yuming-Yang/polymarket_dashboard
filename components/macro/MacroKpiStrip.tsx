import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatSignedPercent, formatUsd } from "@/lib/format";
import { MacroStats } from "@/lib/polymarket/macro/types";

function formatPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

export function MacroKpiStrip({ stats }: { stats: MacroStats }) {
  const coverage1d = new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(stats.clobCoverageRate1d);

  const coverage1w = new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(stats.clobCoverageRate1w);

  const items = [
    {
      label: "Top 50 Volume",
      value: formatUsd(stats.totalVolume24hUsd),
    },
    {
      label: "Median Expectation",
      value: formatPercent(stats.medianExpectationProb),
    },
    {
      label: "Largest |1d| Move",
      value: formatSignedPercent(stats.largestAbsMove1d),
    },
    {
      label: "Largest |1w| Move",
      value: formatSignedPercent(stats.largestAbsMove1w),
    },
    {
      label: "CLOB 1d Coverage",
      value: coverage1d,
    },
    {
      label: "CLOB 1w Coverage",
      value: coverage1w,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <Card key={item.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-slate-500">{item.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold text-slate-900">{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
