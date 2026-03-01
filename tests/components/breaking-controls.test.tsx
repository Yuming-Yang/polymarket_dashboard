import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BreakingControls } from "@/components/BreakingControls";

describe("BreakingControls", () => {
  it("emits control changes", () => {
    const onChange = vi.fn();

    render(
      <BreakingControls
        state={{
          window: "24h",
          limit: 20,
          includeTags: [],
          excludeTags: [],
        }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByText("7d"));
    expect(onChange).toHaveBeenCalledWith({ window: "7d" });

    fireEvent.click(screen.getByRole("button", { name: "Include tags selector" }));
    fireEvent.click(screen.getByRole("button", { name: "Politics" }));
    expect(onChange).toHaveBeenCalledWith({ includeTags: ["Politics"] });
  });
});
