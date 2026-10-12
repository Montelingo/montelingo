import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import NotFound from "./not-found";

describe("NotFound", () => {
  it("is the page's main content, for the skip link to land on", () => {
    render(<NotFound />);

    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(
      screen.getByRole("heading", { level: 1, name: "Page not found" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Go to the home page" }),
    ).toHaveAttribute("href", "/");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<NotFound />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
