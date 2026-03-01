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

    const includeSelect = screen.getByLabelText("Include tags") as HTMLSelectElement;
    includeSelect.options[0].selected = true; // Politics
    fireEvent.change(includeSelect);
    expect(onChange).toHaveBeenCalledWith({ includeTags: ["Politics"] });
  });
});
