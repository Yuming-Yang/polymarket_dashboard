import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PriceHitPageClient } from "@/components/PriceHitPageClient";
import { usePriceHit } from "@/lib/query/usePriceHit";

const replaceMock = vi.fn();
const refetchMock = vi.fn();
const fetchMock = vi.fn<typeof fetch>();
let currentSearchParams = new URLSearchParams("asset=bitcoin&expiry=2026-04-30&event=event-1");

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

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
  usePathname: () => "/price-hit",
  useSearchParams: () => currentSearchParams,
}));

vi.mock("@/lib/query/usePriceHit", () => ({
  usePriceHit: vi.fn(),
}));

function asQueryResult(value: unknown) {
  return value as ReturnType<typeof usePriceHit>;
}

function renderWithClient() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <PriceHitPageClient />
    </QueryClientProvider>,
  );
}

const basePriceHitData = {
  asset: "bitcoin" as const,
  assetLabel: "BTC",
  assetName: "Bitcoin",
  fetchedAt: "2026-03-22T00:00:00.000Z",
  aiCacheStatus: "cache_hit" as const,
  aiRefreshedAt: "2026-03-22T00:00:00.000Z",
  aiExpiresAt: "2026-03-29T00:00:00.000Z",
  structuredEventCount: 2,
  defaultExpiry: "2026-04-30",
  defaultEventId: "event-1",
  expiries: [
    {
      expiryDate: "2026-04-30",
      events: [
        {
          expiryDate: "2026-04-30",
          eventId: "event-1",
          eventTitle: "What price will Bitcoin hit in April 2026?",
          strikeCount: 3,
          impliedMedianPrice: 135_000,
          range90Low: 95_000,
          range90High: 175_000,
          chartMinPrice: 80_000,
          chartMaxPrice: 180_000,
          strikePrices: [100_000, 120_000, 140_000],
          buckets: [
            { key: "lower", kind: "lower", startPrice: 80_000, endPrice: 100_000, centerPrice: 90_000, probabilityDensity: 0.2, label: "< $100k" },
            { key: "mid-1", kind: "interior", startPrice: 100_000, endPrice: 120_000, centerPrice: 110_000, probabilityDensity: 0.1, label: "$100k - $120k" },
            { key: "mid-2", kind: "interior", startPrice: 120_000, endPrice: 140_000, centerPrice: 130_000, probabilityDensity: 0.3, label: "$120k - $140k" },
            { key: "upper", kind: "upper", startPrice: 140_000, endPrice: 180_000, centerPrice: 160_000, probabilityDensity: 0.4, label: ">= $140k" },
          ],
          markets: [
            {
              marketId: "m-1",
              eventId: "event-1",
              eventTitle: "Bitcoin April Targets",
              title: "Will Bitcoin reach $120k?",
              side: "high" as const,
              strikePrice: 120_000,
              probability: 0.45,
              volume24hUsd: 2500,
              volumeTotalUsd: 12000,
              url: "https://polymarket.com/market/btc-120k",
              updatedAt: "2026-03-22T00:00:00.000Z",
            },
          ],
        },
        {
          expiryDate: "2026-04-30",
          eventId: "event-1b",
          eventTitle: "Alternative Bitcoin April Ladder",
          strikeCount: 2,
          impliedMedianPrice: 125_000,
          range90Low: 90_000,
          range90High: 160_000,
          chartMinPrice: 75_000,
          chartMaxPrice: 170_000,
          strikePrices: [95_000, 130_000],
          buckets: [
            { key: "alt-lower", kind: "lower", startPrice: 75_000, endPrice: 95_000, centerPrice: 85_000, probabilityDensity: 0.25, label: "< $95k" },
            { key: "alt-upper", kind: "upper", startPrice: 130_000, endPrice: 170_000, centerPrice: 150_000, probabilityDensity: 0.75, label: ">= $130k" },
          ],
          markets: [],
        },
      ],
    },
    {
      expiryDate: "2026-05-31",
      events: [
        {
          expiryDate: "2026-05-31",
          eventId: "event-2",
          eventTitle: "What price will Bitcoin hit in May 2026?",
          strikeCount: 2,
          impliedMedianPrice: 145_000,
          range90Low: 105_000,
          range90High: 185_000,
          chartMinPrice: 90_000,
          chartMaxPrice: 190_000,
          strikePrices: [120_000, 150_000],
          buckets: [
            { key: "lower-may", kind: "lower", startPrice: 90_000, endPrice: 120_000, centerPrice: 105_000, probabilityDensity: 0.3, label: "< $120k" },
            { key: "upper-may", kind: "upper", startPrice: 150_000, endPrice: 190_000, centerPrice: 170_000, probabilityDensity: 0.7, label: ">= $150k" },
          ],
          markets: [],
        },
      ],
    },
  ],
};

describe("PriceHitPageClient", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    refetchMock.mockReset();
    fetchMock.mockReset();
    currentSearchParams = new URLSearchParams("asset=bitcoin&expiry=2026-04-30&event=event-1");
    vi.stubGlobal("fetch", fetchMock);
  });

  it("renders the chart data and updates URL state from asset chips, expiry tabs, and event tabs", () => {
    vi.mocked(usePriceHit).mockReturnValue(
      asQueryResult({
        data: basePriceHitData,
        isFetching: false,
        isError: false,
        isLoading: false,
        error: null,
        refetch: refetchMock,
      }),
    );

    renderWithClient();

    expect(screen.getByText("Implied median")).toBeInTheDocument();
    expect(screen.getByText("$135,000")).toBeInTheDocument();
    expect(screen.getByText("Will Bitcoin reach $120k?")).toBeInTheDocument();

    replaceMock.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Gold" }));
    expect(replaceMock).toHaveBeenLastCalledWith("/price-hit?asset=gold", { scroll: false });

    fireEvent.click(screen.getByRole("button", { name: "May '26" }));
    expect(replaceMock).toHaveBeenLastCalledWith("/price-hit?asset=bitcoin&expiry=2026-05-31", { scroll: false });

    fireEvent.click(screen.getByRole("button", { name: "Alternative Bitcoin April Ladder" }));
    expect(replaceMock).toHaveBeenLastCalledWith("/price-hit?asset=bitcoin&expiry=2026-04-30&event=event-1b", { scroll: false });
  });

  it("shows AI refresh loading feedback and refetches the active query", async () => {
    vi.mocked(usePriceHit).mockReturnValue(
      asQueryResult({
        data: basePriceHitData,
        isFetching: false,
        isError: false,
        isLoading: false,
        error: null,
        refetch: refetchMock,
      }),
    );

    let resolveFetch!: (value: Response) => void;
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );

    renderWithClient();

    fireEvent.click(screen.getByRole("button", { name: "AI Refresh" }));
    expect(screen.getByText("Refreshing...")).toBeInTheDocument();

    resolveFetch(
      new Response(
        JSON.stringify({
          fetchedAt: "2026-03-22T00:00:00.000Z",
          ok: true,
          results: [
            {
              asset: "bitcoin",
              assetLabel: "BTC",
              ok: true,
              status: "refreshed",
              structuredEventCount: 2,
              refreshedAt: "2026-03-22T00:00:00.000Z",
              expiresAt: "2026-03-29T00:00:00.000Z",
              message: null,
            },
          ],
        }),
        { status: 200 },
      ),
    );

    await waitFor(() => {
      expect(refetchMock).toHaveBeenCalled();
    });
  });

  it("shows the friendly empty state", () => {
    vi.mocked(usePriceHit).mockReturnValue(
      asQueryResult({
        data: {
          ...basePriceHitData,
          structuredEventCount: 0,
          defaultExpiry: null,
          defaultEventId: null,
          expiries: [],
        },
        isFetching: false,
        isError: false,
        isLoading: false,
        error: null,
        refetch: refetchMock,
      }),
    );

    renderWithClient();

    expect(screen.getByText("No usable price hit markets")).toBeInTheDocument();
    expect(screen.getByText(/No price-hit style Polymarket events were classified/)).toBeInTheDocument();
  });

  it("shows the error state when the query fails", () => {
    vi.mocked(usePriceHit).mockReturnValue(
      asQueryResult({
        data: null,
        isFetching: false,
        isError: true,
        isLoading: false,
        error: new Error("Boom"),
        refetch: refetchMock,
      }),
    );

    renderWithClient();

    expect(screen.getByText("Unable to load price hit data")).toBeInTheDocument();
  });
});
