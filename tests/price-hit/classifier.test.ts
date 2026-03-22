import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getPriceHitAssetConfig } from "@/lib/price-hit/assets";
import { classifyPriceHitEvents } from "@/lib/price-hit/classifier";
import { fetchPublicSearch } from "@/lib/polymarket/client";

const fetchMock = vi.fn<typeof fetch>();

vi.mock("@/lib/polymarket/client", () => ({
  fetchPublicSearch: vi.fn(),
}));

describe("price hit classifier", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("OPENAI_API_KEY", "test-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns a deduped validated event list from the AI response", async () => {
    vi.mocked(fetchPublicSearch).mockResolvedValue({
      events: [
        {
          id: "event-1",
          slug: "bitcoin-march-targets",
          title: "Bitcoin March Targets",
          endDate: "2026-03-31",
          markets: [
            {
              id: "m-high-1",
              question: "Will Bitcoin reach $100k in March?",
              groupItemThreshold: "100000",
            },
            {
              id: "m-high-2",
              question: "Will Bitcoin reach $110k in March?",
              groupItemThreshold: "110000",
            },
            {
              id: "m-low-1",
              question: "Will Bitcoin dip to $70k in March?",
              groupItemThreshold: "70000",
            },
            {
              id: "m-low-2",
              question: "Will Bitcoin dip to $65k in March?",
              groupItemThreshold: "65000",
            },
          ],
        },
      ],
    });

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            events: [
              {
                asset: "bitcoin",
                eventId: "event-1",
                eventSlug: "bitcoin-march-targets",
                eventTitle: "Bitcoin March Targets",
                expiryDate: "2026-03-31",
              },
              {
                asset: "bitcoin",
                eventId: "event-1",
                eventSlug: "bitcoin-march-targets",
                eventTitle: "Bitcoin March Targets",
                expiryDate: "2026-03-31",
              },
            ],
          }),
        }),
        { status: 200 },
      ),
    );

    const events = await classifyPriceHitEvents(getPriceHitAssetConfig("bitcoin"));

    expect(events).toEqual([
      {
        asset: "bitcoin",
        eventId: "event-1",
        eventSlug: "bitcoin-march-targets",
        eventTitle: "Bitcoin March Targets",
        expiryDate: "2026-03-31",
      },
    ]);
  });

  it("throws when the AI JSON output does not match the schema", async () => {
    vi.mocked(fetchPublicSearch).mockResolvedValue({
      events: [
        {
          id: "event-1",
          slug: "bitcoin-march-targets",
          title: "Bitcoin March Targets",
          endDate: "2026-03-31",
          markets: [
            {
              question: "Will Bitcoin reach $100k in March?",
            },
            {
              question: "Will Bitcoin reach $110k in March?",
            },
            {
              question: "Will Bitcoin dip to $70k in March?",
            },
            {
              question: "Will Bitcoin dip to $65k in March?",
            },
          ],
        },
      ],
    });

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            events: [
              {
                asset: "bitcoin",
                eventId: 123,
              },
            ],
          }),
        }),
        { status: 200 },
      ),
    );

    await expect(classifyPriceHitEvents(getPriceHitAssetConfig("bitcoin"))).rejects.toThrow();
  });

  it("includes the OpenAI error body when the structured-output request is rejected", async () => {
    vi.mocked(fetchPublicSearch).mockResolvedValue({
      events: [
        {
          id: "event-1",
          slug: "bitcoin-march-targets",
          title: "Bitcoin March Targets",
          endDate: "2026-03-31",
          markets: [
            {
              question: "Will Bitcoin reach $100k in March?",
            },
            {
              question: "Will Bitcoin reach $110k in March?",
            },
            {
              question: "Will Bitcoin dip to $70k in March?",
            },
            {
              question: "Will Bitcoin dip to $65k in March?",
            },
          ],
        },
      ],
    });

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            message: "Schema validation error: root schema must be an object",
          },
        }),
        { status: 400 },
      ),
    );

    await expect(classifyPriceHitEvents(getPriceHitAssetConfig("bitcoin"))).rejects.toThrow(
      "Schema validation error: root schema must be an object",
    );
  });

  it("returns an empty list without calling OpenAI when the search has no events", async () => {
    vi.mocked(fetchPublicSearch).mockResolvedValue({
      events: [],
    });

    const events = await classifyPriceHitEvents(getPriceHitAssetConfig("gold"));

    expect(events).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("drops one-sided or settlement-style events even if the AI returns them", async () => {
    vi.mocked(fetchPublicSearch).mockResolvedValue({
      events: [
        {
          id: "event-keep",
          slug: "bitcoin-hit-march",
          title: "What price will Bitcoin hit in March 2026?",
          endDate: "2026-03-31",
          markets: [
            {
              question: "Will Bitcoin reach $100k in March?",
            },
            {
              question: "Will Bitcoin reach $110k in March?",
            },
            {
              question: "Will Bitcoin dip to $65k in March?",
            },
            {
              question: "Will Bitcoin dip to $60k in March?",
            },
            {
              question: "Will Bitcoin settle above $95k in March?",
            },
          ],
        },
        {
          id: "event-drop",
          slug: "bitcoin-above-march-23",
          title: "Will the price of Bitcoin be above...",
          endDate: "2026-03-23",
          markets: [
            {
              question: "Will the price of Bitcoin be above $76,000 on March 23?",
            },
            {
              question: "Will the price of Bitcoin be above $78,000 on March 23?",
            },
            {
              question: "Will the price of Bitcoin be above $80,000 on March 23?",
            },
          ],
        },
      ],
    });

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            events: [
              {
                asset: "bitcoin",
                eventId: "event-keep",
                eventSlug: "bitcoin-hit-march",
                eventTitle: "What price will Bitcoin hit in March 2026?",
                expiryDate: "2026-03-31",
              },
              {
                asset: "bitcoin",
                eventId: "event-drop",
                eventSlug: "bitcoin-above-march-23",
                eventTitle: "Will the price of Bitcoin be above...",
                expiryDate: "2026-03-23",
              },
            ],
          }),
        }),
        { status: 200 },
      ),
    );

    const events = await classifyPriceHitEvents(getPriceHitAssetConfig("bitcoin"));

    expect(events).toEqual([
      {
        asset: "bitcoin",
        eventId: "event-keep",
        eventSlug: "bitcoin-hit-march",
        eventTitle: "What price will Bitcoin hit in March 2026?",
        expiryDate: "2026-03-31",
      },
    ]);
  });

  it("requires both ladder sides to belong to the selected asset", async () => {
    vi.mocked(fetchPublicSearch).mockResolvedValue({
      events: [
        {
          id: "oil-mixed-event",
          slug: "will-crude-oil-hit-by-end-of-march",
          title: "Will Crude Oil (CL) hit by end of March?",
          endDate: "2026-03-31",
          markets: [
            {
              question: "Will Crude Oil (CL) hit (HIGH) $130 by end of March?",
            },
            {
              question: "Will Crude Oil (CL) hit (HIGH) $140 by end of March?",
            },
            {
              question: "Will gas hit (Low) $3.10 by March 31?",
            },
            {
              question: "Will gas hit (Low) $3.00 by March 31?",
            },
          ],
        },
      ],
    });

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            events: [
              {
                asset: "oil",
                eventId: "oil-mixed-event",
                eventSlug: "will-crude-oil-hit-by-end-of-march",
                eventTitle: "Will Crude Oil (CL) hit by end of March?",
                expiryDate: "2026-03-31",
              },
            ],
          }),
        }),
        { status: 200 },
      ),
    );

    const events = await classifyPriceHitEvents(getPriceHitAssetConfig("oil"));

    expect(events).toEqual([]);
  });
});
