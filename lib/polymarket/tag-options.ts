export const TAG_OPTIONS = [
  "Politics",
  "Sports",
  "Crypto",
  "Finance",
  "Geopolitics",
  "Earnings",
  "Tech",
  "Culture",
  "World",
  "Economy",
  "Fed",
  "Trump",
] as const;

export type TagOption = (typeof TAG_OPTIONS)[number];

function normalizeTag(value: string) {
  return value.trim().toLowerCase();
}

const canonicalTagMap = new Map(TAG_OPTIONS.map((tag) => [normalizeTag(tag), tag]));

export function parseTagSelectionParam(value: string | null | undefined): TagOption[] {
  if (!value) {
    return [];
  }

  const selected: TagOption[] = [];
  const seen = new Set<TagOption>();

  value
    .split(",")
    .map((tag) => canonicalTagMap.get(normalizeTag(tag)) ?? null)
    .filter((tag): tag is TagOption => tag !== null)
    .forEach((tag) => {
      if (!seen.has(tag)) {
        seen.add(tag);
        selected.push(tag);
      }
    });

  return selected;
}

export function serializeTagSelection(tags: string[]): string {
  return tags.join(",");
}
