import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/polymarket/macro/summary/route";
import { MacroSummaryRequest } from "@/lib/polymarket/macro/types";

const fetchMock = vi.fn<typeof fetch>();

function buildSnapshot(): MacroSummaryRequest {
  return {
    snapshotAt: new Date().toISOString(),
    items: [
      {
        id: "m1",
        title: "Fed rates",
        status: "active",
        url: null,
        tags: ["Economy"],
        updatedAt: null,
        volume24hUsd: 100,
        expectationProb: 0.6,
        change1dClob: 0.1,
        change1wClob: 0.15,
        bucket: "Rates & Fed",
        clobMeta: {
          hasToken: true,
          has1dHistory: true,
          has1wHistory: true,
        },
      },
    ],
    groups: [
      {
        bucket: "Rates & Fed",
        count: 1,
        totalVolume24hUsd: 100,
      },
    ],
    stats: {
      marketCount: 1,
      totalVolume24hUsd: 100,
      largestAbsMove1d: 0.1,
      largestAbsMove1w: 0.15,
      medianExpectationProb: 0.6,
      clobCoverageRate1d: 1,
      clobCoverageRate1w: 1,
    },
  };
}

describe("POST /api/polymarket/macro/summary", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns 400 on invalid payload", async () => {
    const request = new NextRequest("http://localhost/api/polymarket/macro/summary", {
      method: "POST",
      body: JSON.stringify({ bad: true }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 503 when AI config is missing", async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
    delete process.env.OPENAI_MACRO_SUMMARY_PROMPT;

    const request = new NextRequest("http://localhost/api/polymarket/macro/summary", {
      method: "POST",
      body: JSON.stringify(buildSnapshot()),
    });

    const response = await POST(request);
    expect(response.status).toBe(503);
  });

  it("returns structured summary on success", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_MODEL = "gpt-test";
    process.env.OPENAI_MACRO_SUMMARY_PROMPT = "Summarize the provided snapshot.";

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          output: [
            {
              content: [
                {
                  text: JSON.stringify({
                    takeaway: "Macro odds imply hawkish expectations are elevated.",
                    topRecentChanges: ["Fed contract moved +10pp over 1d."],
                    groupHighlights: [
                      {
                        group: "Rates & Fed",
                        note: "Rates cluster dominates today's movement.",
                      },
                    ],
                    watchItems: [
                      {
                        title: "Fed rates",
                        reason: "Largest combined 1d/1w movement.",
                      },
                    ],
                  }),
                },
              ],
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const request = new NextRequest("http://localhost/api/polymarket/macro/summary", {
      method: "POST",
      body: JSON.stringify(buildSnapshot()),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.model).toBe("gpt-test");
    expect(json.summary.takeaway).toContain("hawkish");
    expect(json.summary.groupHighlights[0].group).toBe("Rates & Fed");
  });
});
