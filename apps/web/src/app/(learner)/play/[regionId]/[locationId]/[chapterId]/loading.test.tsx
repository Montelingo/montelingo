import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import ChapterLoading from "./loading";

describe("ChapterLoading", () => {
  it("announces that the lesson or game is loading, with nothing to press", () => {
    render(<ChapterLoading />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<ChapterLoading />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
