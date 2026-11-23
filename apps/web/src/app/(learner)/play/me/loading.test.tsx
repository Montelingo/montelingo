import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import MeLoading from "./loading";

describe("MeLoading", () => {
  it("announces that the page is loading, with nothing to press", () => {
    render(<MeLoading />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<MeLoading />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
