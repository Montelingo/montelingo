import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { LearnerHomePlaceholderSkeleton } from "./LearnerHomePlaceholderSkeleton";

describe("LearnerHomePlaceholderSkeleton", () => {
  it("announces that the page is loading", () => {
    render(<LearnerHomePlaceholderSkeleton />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
  });

  it("has nothing to focus", async () => {
    const user = userEvent.setup();
    render(<LearnerHomePlaceholderSkeleton />);

    await user.tab();

    expect(document.body).toHaveFocus();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<LearnerHomePlaceholderSkeleton />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
