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

  it("has no accessibility violations", async () => {
    const { container } = render(<RegionScreenSkeleton />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
