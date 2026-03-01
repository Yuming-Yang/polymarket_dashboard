import { beforeEach, describe, expect, it, vi } from "vitest";

import { enrichCandidatesWithClobChanges, extractYesTokenId } from "@/lib/polymarket/macro/clob";
import { MacroCandidate } from "@/lib/polymarket/macro/select";

const fetchMock = vi.fn<typeof fetch>();

const baseCandidate: MacroCandidate = {
  rawMarket: {
    id: "1",
    question: "Test",
    clobTokenIds: '["yes-token","no-token"]',
  },
  id: "1",
  title: "Test",
  status: "active",
  url: null,
  tags: ["Economy"],
  updatedAt: null,
  volume24hUsd: 100,
  expectationProb: 0.6,
};

describe("extractYesTokenId", () => {
  it("parses token ids from JSON string and array", () => {
    expect(extractYesTokenId({ clobTokenIds: '["a","b"]' })).toBe("a");
    expect(extractYesTokenId({ clobTokenIds: ["x", "y"] })).toBe("x");
    expect(extractYesTokenId({ clobTokenIds: "bad json" })).toBeNull();
  });
});

describe("enrichCandidatesWithClobChanges", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("computes 1d and 1w changes from CLOB history", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ history: [{ p: "0.4" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ history: [{ p: "0.2" }] }), { status: 200 }));

    const [enriched] = await enrichCandidatesWithClobChanges([baseCandidate], { concurrency: 1 });

    expect(enriched.change1dClob).toBeCloseTo(0.2);
    expect(enriched.change1wClob).toBeCloseTo(0.4);
    expect(enriched.clobMeta.has1dHistory).toBe(true);
    expect(enriched.clobMeta.has1wHistory).toBe(true);
  });

  it("returns null changes when no token or expectation", async () => {
    const [enriched] = await enrichCandidatesWithClobChanges(
      [
        {
          ...baseCandidate,
          expectationProb: null,
          rawMarket: { ...baseCandidate.rawMarket, clobTokenIds: null },
        },
      ],
      { concurrency: 1 },
    );

    expect(enriched.change1dClob).toBeNull();
    expect(enriched.change1wClob).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
