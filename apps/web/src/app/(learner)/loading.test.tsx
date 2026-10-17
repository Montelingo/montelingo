import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import LearnerLoading from "./loading";

describe("LearnerLoading", () => {
  it("announces that the page is loading", () => {
    render(<LearnerLoading />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<LearnerLoading />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
