import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { RegionScreenSkeleton } from "./RegionScreenSkeleton";

describe("RegionScreenSkeleton", () => {
  it("announces that the page is loading", () => {
    render(<RegionScreenSkeleton />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
  });

  it("has nothing to focus or press, unlike the cards it stands in for", async () => {
    const user = userEvent.setup();
    render(<RegionScreenSkeleton />);

    await user.tab();

    expect(document.body).toHaveFocus();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  // The skeleton's primitives hide themselves, and a block of its own hides
  // itself, so a layout wrapper needs no aria-hidden of its own.
  it("hides every block, so screen readers hear only the status", () => {
    const { container } = render(<RegionScreenSkeleton />);

    const status = screen.getByRole("status");
    const leaves = Array.from(container.querySelectorAll("*")).filter(
      (element) => element.childElementCount === 0 && element !== status,
    );
    expect(leaves.length).toBeGreaterThan(0);
    for (const leaf of leaves) {
      expect(leaf.closest('[aria-hidden="true"]')).not.toBeNull();
    }
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<RegionScreenSkeleton />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
