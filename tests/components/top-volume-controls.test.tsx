import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TopVolumeControls } from "@/components/TopVolumeControls";

describe("TopVolumeControls", () => {
  it("emits control updates and refresh events", () => {
    const onChange = vi.fn();
    const onRefresh = vi.fn();

    render(
      <TopVolumeControls
        state={{
          entity: "markets",
          window: "24h",
          limit: 10,
          includeTags: [],
          excludeTags: [],
        }}
        onChange={onChange}
        onRefresh={onRefresh}
        isRefreshing={false}
      />,
    );

    fireEvent.click(screen.getByText("Events"));
    expect(onChange).toHaveBeenCalledWith({ entity: "events" });

    const includeSelect = screen.getByLabelText("Include tags") as HTMLSelectElement;
    includeSelect.options[0].selected = true; // Politics
    fireEvent.change(includeSelect);
    expect(onChange).toHaveBeenCalledWith({ includeTags: ["Politics"] });

    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
