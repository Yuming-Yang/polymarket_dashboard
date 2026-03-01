import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatUsd } from "@/lib/format";
import { MACRO_BUCKETS, MacroGroupSummary, MacroMonitorItem } from "@/lib/polymarket/macro/types";
import { ItemStatus } from "@/lib/polymarket/types";

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

function formatProbability(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatSignedChange(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: "always",
  }).format(value);
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

export function MacroGroupsTable({ items, groups }: { items: MacroMonitorItem[]; groups: MacroGroupSummary[] }) {
  const groupMap = new Map(groups.map((group) => [group.bucket, group]));

  return (
    <div className="space-y-4">
      {MACRO_BUCKETS.map((bucket) => {
        const groupItems = items.filter((item) => item.bucket === bucket);
        const group = groupMap.get(bucket);

        return (
          <Card key={bucket}>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">{bucket}</CardTitle>
                <p className="text-sm text-slate-500">
                  {group?.count ?? 0} markets • {formatUsd(group?.totalVolume24hUsd ?? 0)}
                </p>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Market</TableHead>
                    <TableHead>Expectation</TableHead>
                    <TableHead>1d Change (CLOB)</TableHead>
                    <TableHead>1w Change (CLOB)</TableHead>
                    <TableHead>24h Volume</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead className="text-right">Link</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-sm text-slate-500">
                        No markets in this group.
                      </TableCell>
                    </TableRow>
                  ) : (
                    groupItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium text-slate-900">{item.title}</TableCell>
                        <TableCell>{formatProbability(item.expectationProb)}</TableCell>
                        <TableCell>{formatSignedChange(item.change1dClob)}</TableCell>
                        <TableCell>{formatSignedChange(item.change1wClob)}</TableCell>
                        <TableCell className="font-medium">{formatUsd(item.volume24hUsd)}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                        </TableCell>
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
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
