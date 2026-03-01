import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatPrice, formatUsd } from "@/lib/format";
import { ItemStatus, TopVolumeItem, TopVolumeWindow } from "@/lib/polymarket/types";

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

export function TopVolumeCards({ items, window }: { items: TopVolumeItem[]; window: TopVolumeWindow }) {
  return (
    <div className="grid gap-3 md:hidden">
      {items.map((item, index) => (
        <Card key={`${item.kind}-${item.id}`}>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-slate-500">#{index + 1}</p>
                <h3 className="mt-1 text-sm font-semibold text-slate-900">{item.title}</h3>
              </div>
              <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">{window === "24h" ? "24h Volume" : "Total Volume"}</p>
                <p className="font-medium">{formatUsd(item.displayVolumeUsd)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Price</p>
                <p className="font-medium">{item.kind === "market" ? formatPrice(item.price) : "-"}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-1">
              {item.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
                  {tag}
                </span>
              ))}
              {item.tags.length > 3 ? <span className="text-xs text-slate-500">+{item.tags.length - 3}</span> : null}
            </div>

            {item.url ? (
              <Link
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-950"
              >
                Open on Polymarket
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
