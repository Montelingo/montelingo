import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import LocationLoading from "./loading";

describe("LocationLoading", () => {
  it("announces that the place is loading, with nothing to press", () => {
    render(<LocationLoading />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<LocationLoading />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
