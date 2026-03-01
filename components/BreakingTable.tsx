import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPrice, formatSignedPercent, formatUsd } from "@/lib/format";
import { BreakingItem, BreakingWindow, ItemStatus } from "@/lib/polymarket/types";

function statusVariant(status: ItemStatus): "success" | "warning" | "destructive" | "default" {
  if (status === "active") {
    return "success";
  }

  if (status === "resolved") {
    return "warning";
  }

  if (status === "closed") {
    return "destructive";
  }

  return "default";
}

function renderTags(tags: string[]) {
  if (tags.length === 0) {
    return <span className="text-slate-400">-</span>;
  }

  const visible = tags.slice(0, 3);
  const overflow = tags.length - visible.length;

  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((tag) => (
        <span key={tag} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
          {tag}
        </span>
      ))}
      {overflow > 0 ? <span className="text-xs text-slate-500">+{overflow}</span> : null}
    </div>
  );
}

export function BreakingTable({ items, window }: { items: BreakingItem[]; window: BreakingWindow }) {
  return (
    <div className="hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Rank</TableHead>
            <TableHead>Question</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>{window} Change</TableHead>
            <TableHead>Last Price</TableHead>
            <TableHead>24h Volume</TableHead>
            <TableHead>Tags</TableHead>
            <TableHead className="text-right">Link</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, index) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium text-slate-500">#{index + 1}</TableCell>
              <TableCell className="font-medium text-slate-900">{item.title}</TableCell>
              <TableCell>
                <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
              </TableCell>
              <TableCell className="font-medium">{formatSignedPercent(item.priceChange)}</TableCell>
              <TableCell>{formatPrice(item.lastPrice)}</TableCell>
              <TableCell>{formatUsd(item.volume24hUsd)}</TableCell>
              <TableCell>{renderTags(item.tags)}</TableCell>
              <TableCell className="text-right">
                {item.url ? (
                  <Link
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-950"
                  >
                    Open
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                ) : (
                  <span className="text-slate-400">-</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
