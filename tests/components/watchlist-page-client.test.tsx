import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WatchlistPageClient } from "@/components/WatchlistPageClient";
import { useWatchlist } from "@/lib/query/useWatchlist";

const refetchMock = vi.fn();

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => <p {...props}>{children}</p>,
  },
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/query/useWatchlist", () => ({
  useWatchlist: vi.fn(),
}));

function asQueryResult(value: unknown) {
  return value as ReturnType<typeof useWatchlist>;
}

function baseResult(overrides: Record<string, unknown> = {}) {
  return {
    data: null,
    isFetching: false,
    isError: false,
    isLoading: false,
    error: null,
    refetch: refetchMock,
    ...overrides,
  };
}

describe("WatchlistPageClient", () => {
  beforeEach(() => {
    refetchMock.mockReset();
  });

  it("shows the initial empty state with saved searches", () => {
    vi.mocked(useWatchlist).mockReturnValue(asQueryResult(baseResult()));

    render(<WatchlistPageClient />);

    expect(screen.getByText("Saved searches")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Iran" })).toBeInTheDocument();
    expect(screen.queryByText("No markets found")).not.toBeInTheDocument();
  });

  it("submits a typed query and renders the summary above results", () => {
    vi.mocked(useWatchlist).mockImplementation(({ query }) =>
      asQueryResult(
        baseResult(
          query
            ? {
                data: {
                  query,
                  fetchedAt: "2026-03-22T00:00:00.000Z",
                  summary:
                    "Markets imply investors still see a live policy storyline here, but not one with total conviction. The pricing mix suggests expectations are meaningful yet still contested.",
                  summaryStatus: "ready",
                  items: [
                    {
                      id: "m-1",
                      title: "Will Iran talks restart in 2026?",
                      yesPrice: 0.61,
                      noPrice: 0.39,
                      lastTradePrice: 0.61,
                      volume24hUsd: 120000,
                      volumeTotalUsd: 500000,
                      url: "https://polymarket.com/market/iran-talks",
                      status: "active",
                      updatedAt: "2026-03-22T00:00:00.000Z",
                    },
                  ],
                },
              }
            : {},
        ),
      ),
    );

    render(<WatchlistPageClient />);

    fireEvent.change(screen.getByLabelText("Watchlist search"), { target: { value: "Iran" } });
    fireEvent.submit(screen.getByRole("search"));

    const calls = vi.mocked(useWatchlist).mock.calls;
    expect(calls[calls.length - 1]?.[0]).toEqual({ query: "Iran", limit: 12 });
    expect(screen.getByText("AI Summary")).toBeInTheDocument();
    expect(screen.getByText("Will Iran talks restart in 2026?")).toBeInTheDocument();
  });

  it("runs saved searches and shows loading feedback", () => {
    vi.mocked(useWatchlist).mockImplementation(({ query }) =>
      asQueryResult(
        baseResult(
          query === "AI"
            ? {
                isLoading: true,
              }
            : {},
        ),
      ),
    );

    render(<WatchlistPageClient />);

    fireEvent.click(screen.getByRole("button", { name: "AI" }));

    const calls = vi.mocked(useWatchlist).mock.calls;
    expect(calls[calls.length - 1]?.[0]).toEqual({ query: "AI", limit: 12 });
    expect(screen.getByText("Searching...")).toBeInTheDocument();
  });

  it("shows a warning when the AI summary is unavailable", () => {
    vi.mocked(useWatchlist).mockImplementation(({ query }) =>
      asQueryResult(
        baseResult(
          query === "Fed"
            ? {
                data: {
                  query,
                  fetchedAt: "2026-03-22T00:00:00.000Z",
                  summary: null,
                  summaryStatus: "unavailable",
                  items: [
                    {
                      id: "m-1",
                      title: "Will the Fed cut rates by June?",
                      yesPrice: 0.52,
                      noPrice: 0.48,
                      lastTradePrice: 0.52,
                      volume24hUsd: 95000,
                      volumeTotalUsd: 310000,
                      url: "https://polymarket.com/market/fed-cut-rates",
                      status: "active",
                      updatedAt: "2026-03-22T00:00:00.000Z",
                    },
                  ],
                },
              }
            : {},
        ),
      ),
    );

    render(<WatchlistPageClient />);

    fireEvent.click(screen.getByRole("button", { name: "Fed" }));

    expect(screen.getByText("AI summary unavailable right now")).toBeInTheDocument();
    expect(screen.getByText("Will the Fed cut rates by June?")).toBeInTheDocument();
  });

  it("shows an empty state after a search with no results", () => {
    vi.mocked(useWatchlist).mockImplementation(({ query }) =>
      asQueryResult(
        baseResult(
          query === "Largest Company"
            ? {
                data: {
                  query,
                  fetchedAt: "2026-03-22T00:00:00.000Z",
                  summary: null,
                  summaryStatus: "unavailable",
                  items: [],
                },
              }
            : {},
        ),
      ),
    );

    render(<WatchlistPageClient />);

    fireEvent.click(screen.getByRole("button", { name: "Largest Company" }));

    expect(screen.getByText("No markets found")).toBeInTheDocument();
    expect(screen.getAllByText(/Largest Company/).length).toBeGreaterThan(0);
  });
});
