import { describe, expect, it } from "vitest";

import {
  fetchCandidateMarketsForScan,
  fetchMarketTrades,
} from "@/lib/insider/clob";

const itIfLive = process.env.POLYMARKET_LIVE_SMOKE === "1" ? it : it.skip;

describe("insider upstream live smoke", () => {
  itIfLive(
    "hits gamma candidate discovery and data api market trades",
    async () => {
      const markets = await fetchCandidateMarketsForScan({
        limit: 3,
      });

      expect(markets.length).toBeGreaterThan(0);

      const batch = await fetchMarketTrades({
        marketId: markets[0].conditionId,
        limit: 5,
        maxPages: 1,
      });

      expect(batch.diagnostics.rawCount).toBeGreaterThanOrEqual(
        batch.trades.length,
      );
      expect(batch.diagnostics.normalizedCount).toBeGreaterThanOrEqual(
        batch.trades.length,
      );
    },
    30_000,
  );
});
