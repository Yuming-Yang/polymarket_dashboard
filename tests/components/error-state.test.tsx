import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ErrorState } from "@/components/ErrorState";

describe("ErrorState", () => {
  it("renders message and retry callback", () => {
    const onRetry = vi.fn();

    render(<ErrorState message="boom" onRetry={onRetry} />);

    expect(screen.getByText("boom")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
