import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MacroGroupsTable } from "@/components/macro/MacroGroupsTable";

describe("MacroGroupsTable", () => {
  it("renders expectation and N/A for missing CLOB changes", () => {
    render(
      <MacroGroupsTable
        items={[
          {
            id: "m1",
            title: "Fed rates",
            status: "active",
            url: null,
            tags: ["Economy"],
            updatedAt: null,
            volume24hUsd: 100,
            expectationProb: 0.62,
            change1dClob: null,
            change1wClob: null,
            bucket: "Rates & Fed",
            clobMeta: {
              hasToken: true,
              has1dHistory: false,
              has1wHistory: false,
            },
          },
        ]}
        groups={[
          {
            bucket: "Rates & Fed",
            count: 1,
            totalVolume24hUsd: 100,
          },
        ]}
      />,
    );

    expect(screen.getByText("Fed rates")).toBeInTheDocument();
    expect(screen.getByText("62.0%")).toBeInTheDocument();
    expect(screen.getAllByText("N/A").length).toBeGreaterThanOrEqual(2);
  });
});
