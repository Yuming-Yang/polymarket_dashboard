export type InsiderFlag =
  | "new_wallet"
  | "young_wallet"
  | "large_bet_vs_market"
  | "above_average_bet"
  | "single_market_focus"
  | "narrow_focus"
  | "high_win_rate"
  | "good_win_rate"
  | "consecutive_large_bets"
  | "niche_market_large_bet"
  | "thin_market_large_bet";

export type InsiderTradeSide = "BUY" | "SELL";

export type ClobTrade = {
  tradeId: string;
  marketId: string;
  marketSlug: string | null;
  marketTitle: string | null;
  wallet: string;
  tokenId: string | null;
  outcome: string | null;
  side: InsiderTradeSide;
  price: number;
  sizeUsdc: number;
  shareSize: number | null;
  timestamp: string;
  timestampMs: number;
  raw: Record<string, unknown>;
};

export type WalletStats = {
  wallet: string;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  totalTrades: number;
  totalWins: number;
  resolvedTrades: number;
  totalVolume: number;
  markets: string[];
  consecutiveLarge: number;
  updatedAt: string | null;
  marketCount: number;
  walletAgeHours: number | null;
  walletWinRate: number | null;
};

export type SuspicionScoreInput = {
  trade: Pick<ClobTrade, "sizeUsdc">;
  wallet: Pick<WalletStats, "walletAgeHours" | "walletWinRate" | "marketCount" | "totalTrades" | "resolvedTrades" | "consecutiveLarge">;
  marketAverageTradeSize: number | null;
  marketVolume24h: number | null;
};

export type SuspicionScoreResult = {
  score: number;
  flags: InsiderFlag[];
};

export type InsiderAlert = {
  id: number;
  detectedAt: string;
  tradeId: string;
  marketId: string;
  marketSlug: string | null;
  marketTitle: string;
  wallet: string;
  sizeUsdc: number;
  price: number;
  side: InsiderTradeSide;
  score: number;
  flags: InsiderFlag[];
  walletAgeHours: number | null;
  walletWinRate: number | null;
  walletTotalTrades: number;
};

export type AlertSummary = {
  totalAlerts: number;
  highScoreAlerts: number;
  newWalletAlerts: number;
};

export type InsiderAlertsResponse = {
  params: {
    minScore: number;
    limit: number;
    marketId: string | null;
  };
  fetchedAt: string;
  lastScannedAt: string | null;
  summary: AlertSummary;
  items: InsiderAlert[];
};

export type WalletAlertsResponse = {
  fetchedAt: string;
  lastScannedAt: string | null;
  wallet: string;
  stats: WalletStats | null;
  alerts: InsiderAlert[];
};

export type MarketToken = {
  tokenId: string | null;
  outcome: string | null;
  winner: boolean;
};

export type MarketDetail = {
  id: string;
  slug: string | null;
  title: string | null;
  volume24h: number | null;
  resolved: boolean;
  closed: boolean;
  tokens: MarketToken[];
};

export type TradeLedgerRow = {
  tradeId: string;
  marketId: string;
  marketSlug: string | null;
  marketTitle: string;
  wallet: string;
  tokenId: string | null;
  outcome: string | null;
  side: InsiderTradeSide;
  sizeUsdc: number;
  price: number;
  tradedAt: string;
  isLarge: boolean;
  isWin: boolean | null;
  winApplied: boolean;
  raw: Record<string, unknown>;
};

export type ScanState = {
  lastScannedAt: string | null;
  scannedCount: number;
  analyzedCount: number;
  alertsCount: number;
};
