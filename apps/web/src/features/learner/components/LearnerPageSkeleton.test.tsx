import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { LearnerPageSkeleton } from "./LearnerPageSkeleton";

describe("LearnerPageSkeleton", () => {
  it("announces that the page is loading", () => {
    render(<LearnerPageSkeleton />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
  });

  it("has nothing to focus", async () => {
    const user = userEvent.setup();
    render(<LearnerPageSkeleton />);

    await user.tab();

    expect(document.body).toHaveFocus();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<LearnerPageSkeleton />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
