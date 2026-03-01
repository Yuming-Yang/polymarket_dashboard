export function formatUsd(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPrice(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "-";
  }

  return value.toFixed(3);
}

export function formatSignedPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: "always",
  }).format(value);
}

export function formatRelativeUpdatedAt(value: string | null, now: number) {
  if (!value) {
    return "Updated just now";
  }

  const parsed = new Date(value).getTime();
  if (Number.isNaN(parsed)) {
    return "Updated just now";
  }

  const seconds = Math.max(0, Math.floor((now - parsed) / 1000));
  return `Updated ${seconds}s ago`;
}
