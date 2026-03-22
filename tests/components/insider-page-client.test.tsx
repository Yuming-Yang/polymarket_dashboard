import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { InsiderPageClient } from "@/components/InsiderPageClient";
import { useInsiderAlerts } from "@/lib/query/useInsiderAlerts";

const replaceMock = vi.fn();
let currentSearchParams = new URLSearchParams("minScore=6&limit=50");

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => <p {...props}>{children}</p>,
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
  usePathname: () => "/insider",
  useSearchParams: () => currentSearchParams,
}));

vi.mock("@/lib/query/useInsiderAlerts", () => ({
  useInsiderAlerts: vi.fn(),
}));

function asQueryResult(value: unknown) {
  return value as ReturnType<typeof useInsiderAlerts>;
}

describe("InsiderPageClient", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    currentSearchParams = new URLSearchParams("minScore=6&limit=50");
  });

  it("renders summary data and updates the score filter in the URL", () => {
    vi.mocked(useInsiderAlerts).mockReturnValue(
      asQueryResult({
      data: {
        params: { minScore: 6, limit: 50, marketId: null },
        fetchedAt: new Date().toISOString(),
        lastScannedAt: new Date().toISOString(),
        summary: {
          totalAlerts: 12,
          highScoreAlerts: 4,
          newWalletAlerts: 3,
        },
        items: [
          {
            id: 1,
            detectedAt: "2026-03-22T10:00:00.000Z",
            tradeId: "trade-1",
            marketId: "market-1",
            marketSlug: "market-1",
            marketTitle: "Will event happen?",
            wallet: "0xabcdef1234567890",
            sizeUsdc: 1_250,
            price: 0.41,
            side: "BUY",
            score: 8.5,
            flags: ["new_wallet"],
            walletAgeHours: 4,
            walletWinRate: 0.75,
            walletTotalTrades: 5,
          },
        ],
      },
      isFetching: false,
      isError: false,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      }),
    );

    render(<InsiderPageClient />);

    expect(screen.getByText("12 alerts · 4 score 8+ · 3 with new wallet flag")).toBeInTheDocument();
    expect(screen.getByText("Will event happen?")).toBeInTheDocument();
    expect(screen.getByText("🆕 New Wallet")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "8+" }));
    expect(replaceMock).toHaveBeenCalledWith("/insider?minScore=8&limit=50", { scroll: false });
  });

  it("shows the empty state when there are no alerts", () => {
    vi.mocked(useInsiderAlerts).mockReturnValue(
      asQueryResult({
      data: {
        params: { minScore: 6, limit: 50, marketId: null },
        fetchedAt: new Date().toISOString(),
        lastScannedAt: new Date().toISOString(),
        summary: {
          totalAlerts: 0,
          highScoreAlerts: 0,
          newWalletAlerts: 0,
        },
        items: [],
      },
      isFetching: false,
      isError: false,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      }),
    );

    render(<InsiderPageClient />);

    expect(screen.getByText("No suspicious trades yet")).toBeInTheDocument();
  });

  it("shows the error state and loading skeletons when needed", () => {
    vi.mocked(useInsiderAlerts).mockReturnValue(
      asQueryResult({
      data: null,
      isFetching: false,
      isError: true,
      isLoading: false,
      error: new Error("Boom"),
      refetch: vi.fn(),
      }),
    );

    const { container, rerender } = render(<InsiderPageClient />);
    expect(screen.getByText("Unable to load insider alerts")).toBeInTheDocument();

    vi.mocked(useInsiderAlerts).mockReturnValue(
      asQueryResult({
      data: null,
      isFetching: false,
      isError: false,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
      }),
    );

    rerender(<InsiderPageClient />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });
});
