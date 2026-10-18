import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import PlayPage, { metadata } from "./page";

describe("PlayPage", () => {
  it("is titled", () => {
    expect(metadata.title).toBe("Your map");
  });

  it("says the map is on its way", () => {
    render(<PlayPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Your map" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Your map is on its way")).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<PlayPage />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
