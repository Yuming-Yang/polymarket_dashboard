import React from "react";
import { render, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import HomePage from "@/app/page";
import { Nav } from "@/components/Nav";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("Links discoverability", () => {
  it("adds Links as the last shell navigation tab", () => {
    const { container } = render(<Nav />);
    const nav = container.querySelector("nav");

    expect(nav).not.toBeNull();
    expect(within(nav as HTMLElement).getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Trending",
      "Breaking",
      "Search",
      "Price Hit",
      "Insider",
      "Links",
    ]);
  });

  it("adds Links as the last landing-page quick link", () => {
    const { container } = render(<HomePage />);
    const main = container.querySelector("main");

    expect(main).not.toBeNull();
    expect(within(main as HTMLElement).getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Trending",
      "Breaking",
      "Search",
      "Price Hit",
      "Insider",
      "Links",
    ]);
  });
});
