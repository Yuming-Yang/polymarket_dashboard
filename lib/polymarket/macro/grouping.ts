import { MACRO_BUCKETS, MacroBucket, MacroGroupSummary, MacroMonitorItem } from "@/lib/polymarket/macro/types";

const bucketRules: Array<{ bucket: Exclude<MacroBucket, "Other Economy/Finance">; keywords: string[] }> = [
  {
    bucket: "Rates & Fed",
    keywords: ["fed", "fomc", "rate", "interest", "yield", "treasury", "powell"],
  },
  {
    bucket: "Inflation",
    keywords: ["inflation", "cpi", "pce", "deflation", "price index"],
  },
  {
    bucket: "Growth & Labor",
    keywords: ["gdp", "recession", "growth", "payroll", "jobs", "unemployment", "labor"],
  },
  {
    bucket: "Equities & Earnings",
    keywords: ["s&p", "nasdaq", "dow", "stocks", "earnings", "guidance"],
  },
  {
    bucket: "Policy & Fiscal",
    keywords: ["tariff", "tax", "budget", "deficit", "debt ceiling", "shutdown", "stimulus"],
  },
  {
    bucket: "Crypto Macro",
    keywords: ["bitcoin", "btc", "ethereum", "eth", "solana", "crypto etf"],
  },
];

function toSearchText(title: string, tags: string[]) {
  return `${title} ${tags.join(" ")}`.toLowerCase();
}

export function assignMacroBucket(title: string, tags: string[]): MacroBucket {
  const text = toSearchText(title, tags);

  for (const rule of bucketRules) {
    const hasMatch = rule.keywords.some((keyword) => text.includes(keyword));
    if (hasMatch) {
      return rule.bucket;
    }
  }

  return "Other Economy/Finance";
}

export function summarizeMacroGroups(items: MacroMonitorItem[]): MacroGroupSummary[] {
  const counts = new Map<MacroBucket, { count: number; volume: number }>();

  for (const bucket of MACRO_BUCKETS) {
    counts.set(bucket, { count: 0, volume: 0 });
  }

  for (const item of items) {
    const current = counts.get(item.bucket);
    if (!current) {
      continue;
    }

    current.count += 1;
    current.volume += item.volume24hUsd ?? 0;
  }

  return MACRO_BUCKETS.map((bucket) => ({
    bucket,
    count: counts.get(bucket)?.count ?? 0,
    totalVolume24hUsd: counts.get(bucket)?.volume ?? 0,
  }));
}
