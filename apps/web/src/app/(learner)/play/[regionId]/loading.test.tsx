import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import RegionLoading from "./loading";

describe("RegionLoading", () => {
  it("announces that the region is loading, with nothing to press", () => {
    render(<RegionLoading />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<RegionLoading />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
