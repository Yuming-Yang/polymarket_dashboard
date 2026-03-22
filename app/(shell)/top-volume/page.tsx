import { redirect } from "next/navigation";

type SearchParamsValue = string | string[] | undefined;

function buildRedirectUrl(pathname: string, searchParams: Record<string, SearchParamsValue>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        params.append(key, entry);
      }
      continue;
    }

    if (typeof value === "string") {
      params.set(key, value);
    }
  }

  const query = params.toString();

  return query ? `${pathname}?${query}` : pathname;
}

export default async function TopVolumeRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, SearchParamsValue>>;
}) {
  redirect(buildRedirectUrl("/trending", await searchParams));
}
