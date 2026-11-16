import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { InvalidResetLink } from "./InvalidResetLink";

function heading() {
  return screen.getByRole("heading", {
    level: 1,
    name: "Ovaj link ne radi",
  });
}

describe("InvalidResetLink", () => {
  it("explains the link no longer works", () => {
    render(<InvalidResetLink />);

    expect(heading()).toBeInTheDocument();
    expect(
      screen.getByText(/Linkovi za novu lozinku rade samo jednom/),
    ).toBeInTheDocument();
  });

  it("links to request a new link and back to sign in", () => {
    render(<InvalidResetLink />);

    expect(
      screen.getByRole("link", { name: "Zatraži novi link" }),
    ).toHaveAttribute("href", "/forgot-password");
    expect(
      screen.getByRole("link", { name: "Nazad na prijavu" }),
    ).toHaveAttribute("href", "/sign-in");
  });

  it("leaves focus alone by default, as on page load", () => {
    render(<InvalidResetLink />);

    expect(heading()).not.toHaveFocus();
    expect(heading()).not.toHaveAttribute("tabindex");
  });

  it("focuses its heading when it replaces the form", () => {
    render(<InvalidResetLink focusOnMount />);

    expect(heading()).toHaveFocus();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<InvalidResetLink focusOnMount />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
