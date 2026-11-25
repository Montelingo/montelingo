import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import WordsLoading from "./loading";

describe("WordsLoading", () => {
  it("announces that the page is loading, with nothing to press", () => {
    render(<WordsLoading />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<WordsLoading />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
