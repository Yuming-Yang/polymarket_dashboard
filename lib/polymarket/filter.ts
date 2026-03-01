function normalizeTag(value: string) {
  return value.trim().toLowerCase();
}

export function parseTagCsv(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  const unique = new Set<string>();

  value
    .split(",")
    .map((tag) => normalizeTag(tag))
    .filter((tag) => tag.length > 0)
    .forEach((tag) => unique.add(tag));

  return [...unique];
}

function toNormalizedTagSet(tags: string[]) {
  return new Set(tags.map((tag) => normalizeTag(tag)).filter((tag) => tag.length > 0));
}

type TaggableItem = {
  tags: string[];
};

export function applyTagFilters<T extends TaggableItem>(items: T[], includeTags: string[], excludeTags: string[]): T[] {
  const includeSet = new Set(includeTags.map((tag) => normalizeTag(tag)).filter((tag) => tag.length > 0));
  const excludeSet = new Set(excludeTags.map((tag) => normalizeTag(tag)).filter((tag) => tag.length > 0));

  return items.filter((item) => {
    const itemTags = toNormalizedTagSet(item.tags);

    if (includeSet.size > 0) {
      const hasIncludedTag = [...includeSet].some((includeTag) => itemTags.has(includeTag));
      if (!hasIncludedTag) {
        return false;
      }
    }

    if (excludeSet.size > 0) {
      const hasExcludedTag = [...excludeSet].some((excludeTag) => itemTags.has(excludeTag));
      if (hasExcludedTag) {
        return false;
      }
    }

    return true;
  });
}
