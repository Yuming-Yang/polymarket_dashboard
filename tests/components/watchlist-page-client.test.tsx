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

    expect(screen.queryByText("Saved searches")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fed" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "AI" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trump" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Iran" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bitcoin" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crypto" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Largest Company" })).toBeInTheDocument();
    expect(screen.queryByText("No events found")).not.toBeInTheDocument();
  });

  it("submits a typed query, keeps markets collapsed by default, and expands on demand", () => {
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
                  events: [
                    {
                      id: "event-1",
                      title: "Iran Diplomatic Outlook",
                      url: "https://polymarket.com/event/iran-diplomatic-outlook",
                      status: "active",
                      volume24hUsd: 120000,
                      volumeTotalUsd: 500000,
                      marketCount: 1,
                      updatedAt: "2026-03-22T00:00:00.000Z",
                      markets: [
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
                  ],
                },
              }
            : {},
        ),
      ),
    );

    render(<WatchlistPageClient />);

    fireEvent.change(screen.getByLabelText("Search topics"), { target: { value: "Iran" } });
    fireEvent.submit(screen.getByRole("search"));

    const calls = vi.mocked(useWatchlist).mock.calls;
    expect(calls[calls.length - 1]?.[0]).toEqual({ query: "Iran", limit: 12 });
    expect(screen.getByText("AI Summary")).toBeInTheDocument();
    expect(screen.getByText("Iran Diplomatic Outlook")).toBeInTheDocument();
    expect(screen.queryByText("Will Iran talks restart in 2026?")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show 1 market" }));

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
                  events: [
                    {
                      id: "event-1",
                      title: "Fed Rate Decision",
                      url: "https://polymarket.com/event/fed-rate-decision",
                      status: "active",
                      volume24hUsd: 95000,
                      volumeTotalUsd: 310000,
                      marketCount: 1,
                      updatedAt: "2026-03-22T00:00:00.000Z",
                      markets: [
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
    expect(screen.getByText("Fed Rate Decision")).toBeInTheDocument();
    expect(screen.queryByText("Will the Fed cut rates by June?")).not.toBeInTheDocument();
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
                  events: [],
                },
              }
            : {},
        ),
      ),
    );

    render(<WatchlistPageClient />);

    fireEvent.click(screen.getByRole("button", { name: "Largest Company" }));

    expect(screen.getByText("No events found")).toBeInTheDocument();
    expect(screen.getAllByText(/Largest Company/).length).toBeGreaterThan(0);
  });
});
