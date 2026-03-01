import { TopVolumeItem, TopVolumeWindow } from "@/lib/polymarket/types";

export function selectDisplayVolume(item: TopVolumeItem, window: TopVolumeWindow): number | null {
  return window === "24h" ? item.volume24hUsd : item.volumeTotalUsd;
}

export function withDisplayVolume(items: TopVolumeItem[], window: TopVolumeWindow): TopVolumeItem[] {
  return items.map((item) => ({
    ...item,
    displayVolumeUsd: selectDisplayVolume(item, window),
  }));
}

export function compareByDisplayVolumeDesc(a: TopVolumeItem, b: TopVolumeItem) {
  const left = a.displayVolumeUsd ?? Number.NEGATIVE_INFINITY;
  const right = b.displayVolumeUsd ?? Number.NEGATIVE_INFINITY;
  return right - left;
}
