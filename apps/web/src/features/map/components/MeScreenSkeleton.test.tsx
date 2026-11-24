import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { MeScreenSkeleton } from "./MeScreenSkeleton";

describe("MeScreenSkeleton", () => {
  it("announces that the page is loading", () => {
    render(<MeScreenSkeleton />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
  });

  it("has nothing to focus or press", async () => {
    const user = userEvent.setup();
    render(<MeScreenSkeleton />);

    await user.tab();

    expect(document.body).toHaveFocus();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<MeScreenSkeleton />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
