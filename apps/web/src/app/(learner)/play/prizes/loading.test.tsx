import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import PrizesLoading from "./loading";

describe("PrizesLoading", () => {
  it("announces that the prizes are loading, with nothing to press", () => {
    render(<PrizesLoading />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<PrizesLoading />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
