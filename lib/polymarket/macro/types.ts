export const MACRO_DEFAULT_LIMIT = 50;
export const MACRO_MAX_LIMIT = 300;

export const MACRO_BUCKETS = [
  "Rates & Fed",
  "Inflation",
  "Growth & Labor",
  "Equities & Earnings",
  "Policy & Fiscal",
  "Crypto Macro",
  "Other Economy/Finance",
] as const;

export type MacroBucket = (typeof MACRO_BUCKETS)[number];

export type MacroClobMeta = {
  hasToken: boolean;
  has1dHistory: boolean;
  has1wHistory: boolean;
};

export type MacroMonitorItem = {
  id: string;
  title: string;
  status: "active" | "resolved" | "closed" | "unknown";
  url: string | null;
  tags: string[];
  updatedAt: string | null;
  volume24hUsd: number | null;
  expectationProb: number | null;
  change1dClob: number | null;
  change1wClob: number | null;
  bucket: MacroBucket;
  clobMeta: MacroClobMeta;
};

export type MacroGroupSummary = {
  bucket: MacroBucket;
  count: number;
  totalVolume24hUsd: number;
};

export type MacroStats = {
  marketCount: number;
  totalVolume24hUsd: number;
  largestAbsMove1d: number | null;
  largestAbsMove1w: number | null;
  medianExpectationProb: number | null;
  clobCoverageRate1d: number;
  clobCoverageRate1w: number;
};

export type MacroResponse = {
  params: {
    limit: number;
    includeTagsFixed: ["economy", "finance"];
  };
  fetchedAt: string;
  items: MacroMonitorItem[];
  groups: MacroGroupSummary[];
  stats: MacroStats;
};

export type MacroSummaryRequest = {
  snapshotAt: string;
  items: MacroMonitorItem[];
  groups: MacroGroupSummary[];
  stats: MacroStats;
};

export type MacroSummary = {
  takeaway: string;
  topRecentChanges: string[];
  groupHighlights: Array<{
    group: MacroBucket;
    note: string;
  }>;
  watchItems: Array<{
    title: string;
    reason: string;
  }>;
};

export type MacroSummaryResponse = {
  generatedAt: string;
  model: string;
  summary: MacroSummary;
};
