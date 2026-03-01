import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MacroSummaryPanel } from "@/components/macro/MacroSummaryPanel";

describe("MacroSummaryPanel", () => {
  it("invokes generate callback and renders summary sections", () => {
    const onGenerate = vi.fn();

    render(
      <MacroSummaryPanel
        hasSnapshot
        isGenerating={false}
        errorMessage={null}
        onGenerate={onGenerate}
        summary={{
          generatedAt: new Date().toISOString(),
          model: "gpt-test",
          summary: {
            takeaway: "Main takeaway",
            topRecentChanges: ["Change A"],
            groupHighlights: [{ group: "Rates & Fed", note: "Note A" }],
            watchItems: [{ title: "Item A", reason: "Reason A" }],
          },
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /generate ai summary/i }));
    expect(onGenerate).toHaveBeenCalledTimes(1);

    expect(screen.getByText("Takeaway")).toBeInTheDocument();
    expect(screen.getByText("Main takeaway")).toBeInTheDocument();
    expect(screen.getByText("Top Recent Changes")).toBeInTheDocument();
    expect(screen.getByText("Group Highlights")).toBeInTheDocument();
    expect(screen.getByText("Watch Items")).toBeInTheDocument();
  });
});
