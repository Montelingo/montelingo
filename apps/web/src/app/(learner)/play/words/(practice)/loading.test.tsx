import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import PracticeLoading from "./loading";

describe("PracticeLoading", () => {
  it("announces that the game is loading, with nothing to press", () => {
    render(<PracticeLoading />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<PracticeLoading />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
