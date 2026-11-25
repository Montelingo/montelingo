import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import GrownUpsLoading from "./loading";

describe("GrownUpsLoading", () => {
  it("announces that the page is loading", () => {
    render(<GrownUpsLoading />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<GrownUpsLoading />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
