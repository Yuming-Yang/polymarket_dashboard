import { TopVolumeEntity, TopVolumeWindow } from "@/lib/polymarket/types";

type TopVolumeKeyParams = {
  entity: TopVolumeEntity;
  window: TopVolumeWindow;
  limit: number;
  includeTags: string[];
  excludeTags: string[];
};

export const queryKeys = {
  topVolume: (params: TopVolumeKeyParams) =>
    [
      "top-volume",
      params.entity,
      params.window,
      params.limit,
      params.includeTags.join(","),
      params.excludeTags.join(","),
    ] as const,
};
