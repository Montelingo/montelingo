import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import LearnerNotFound from "./not-found";

describe("LearnerNotFound", () => {
  it("leads back to the map", () => {
    render(<LearnerNotFound />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "We couldn’t find that page.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Go to your map" }),
    ).toHaveAttribute("href", "/play");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<LearnerNotFound />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
