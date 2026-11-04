import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { MapHomeSkeleton } from "./MapHomeSkeleton";

describe("MapHomeSkeleton", () => {
  it("announces that the page is loading", () => {
    render(<MapHomeSkeleton />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
  });

  it("has nothing to focus or press, unlike the cards it stands in for", async () => {
    const user = userEvent.setup();
    render(<MapHomeSkeleton />);

    await user.tab();

    expect(document.body).toHaveFocus();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<MapHomeSkeleton />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
