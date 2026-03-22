import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatUsd } from "@/lib/format";
import { InsiderAlert } from "@/lib/insider/types";
import { cn } from "@/lib/utils";

const FLAG_LABELS: Record<string, string> = {
  new_wallet: "🆕 New Wallet",
  young_wallet: "🌱 Young Wallet",
  large_bet_vs_market: "📈 5x Market Avg",
  above_average_bet: "📊 2x Market Avg",
  single_market_focus: "🎯 Single Market Focus",
  narrow_focus: "🧭 Narrow Focus",
  high_win_rate: "🏆 High Win Rate",
  good_win_rate: "✅ Good Win Rate",
  consecutive_large_bets: "🔥 3+ Large Bets",
  niche_market_large_bet: "🧪 Niche Market Bet",
  thin_market_large_bet: "💧 Thin Market Bet",
};

function shortenWallet(wallet: string) {
  if (wallet.length <= 12) {
    return wallet;
  }

  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

function formatDetectedAt(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatCents(price: number) {
  const cents = price * 100;
  return `${cents.toFixed(cents % 1 === 0 ? 0 : 1)}c`;
}

function formatWalletAge(hours: number | null) {
  if (hours === null || Number.isNaN(hours)) {
    return "-";
  }

  if (hours < 24) {
    return `${hours.toFixed(hours >= 10 ? 0 : 1)}h`;
  }

  const days = hours / 24;
  return `${days.toFixed(days >= 10 ? 0 : 1)}d`;
}

function formatWinRate(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(value);
}

function scoreBadgeClass(score: number) {
  if (score >= 8) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (score >= 6) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-100 text-slate-700";
}

function sideBadgeClass(side: InsiderAlert["side"]) {
  return side === "BUY"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-red-200 bg-red-50 text-red-700";
}

export function InsiderAlertCard({ alert }: { alert: InsiderAlert }) {
  const marketHref = alert.marketSlug ? `https://polymarket.com/event/${alert.marketSlug}` : null;
  const walletHref = `https://polymarket.com/profile/${alert.wallet}`;

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={scoreBadgeClass(alert.score)}>Score {alert.score.toFixed(1)}</Badge>
              <Badge className={sideBadgeClass(alert.side)}>{alert.side}</Badge>
              <span className="text-xs uppercase tracking-wide text-slate-500">Detected {formatDetectedAt(alert.detectedAt)}</span>
            </div>

            {marketHref ? (
              <Link
                href={marketHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-lg font-semibold text-slate-900 transition hover:text-slate-700"
              >
                {alert.marketTitle}
                <ExternalLink className="h-4 w-4" />
              </Link>
            ) : (
              <h3 className="text-lg font-semibold text-slate-900">{alert.marketTitle}</h3>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[320px]">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Bet Size</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{formatUsd(alert.sizeUsdc)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Price</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{formatCents(alert.price)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Wallet</p>
              <Link
                href={walletHref}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-slate-900 transition hover:text-slate-700"
              >
                <span className="font-mono">{shortenWallet(alert.wallet)}</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Wallet Age</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{formatWalletAge(alert.walletAgeHours)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Win Rate</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{formatWinRate(alert.walletWinRate)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Wallet Trades</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{alert.walletTotalTrades}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {alert.flags.map((flag) => (
            <span
              key={flag}
              className={cn("rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700")}
            >
              {FLAG_LABELS[flag] ?? flag}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
