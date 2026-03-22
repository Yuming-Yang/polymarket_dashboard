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
              id: "m-1",
              question: "Will Bitcoin reach $100k?",
              groupItemThreshold: "100000",
            },
          ],
        },
      ],
    });

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          output_text: JSON.stringify([
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
          ]),
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
          markets: [],
        },
      ],
    });

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          output_text: JSON.stringify([
            {
              asset: "bitcoin",
              eventId: 123,
            },
          ]),
        }),
        { status: 200 },
      ),
    );

    await expect(classifyPriceHitEvents(getPriceHitAssetConfig("bitcoin"))).rejects.toThrow();
  });

  it("returns an empty list without calling OpenAI when the search has no events", async () => {
    vi.mocked(fetchPublicSearch).mockResolvedValue({
      events: [],
    });

    const events = await classifyPriceHitEvents(getPriceHitAssetConfig("gold"));

    expect(events).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
