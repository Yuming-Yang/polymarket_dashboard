import { BreakingWindow, TopVolumeEntity, TopVolumeWindow } from "@/lib/polymarket/types";

type TopVolumeKeyParams = {
  entity: TopVolumeEntity;
  window: TopVolumeWindow;
  limit: number;
  includeTags: string[];
  excludeTags: string[];
};

type BreakingKeyParams = {
  window: BreakingWindow;
  limit: number;
  includeTags: string[];
  excludeTags: string[];
};

type MacroKeyParams = {
  limit: number;
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
  breaking: (params: BreakingKeyParams) =>
    [
      "breaking",
      params.window,
      params.limit,
      params.includeTags.join(","),
      params.excludeTags.join(","),
    ] as const,
  macro: (params: MacroKeyParams) => ["macro", params.limit] as const,
};
