import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { InvalidResetLink } from "./InvalidResetLink";

function heading() {
  return screen.getByRole("heading", {
    level: 1,
    name: "This reset link doesn’t work",
  });
}

describe("InvalidResetLink", () => {
  it("explains the link no longer works", () => {
    render(<InvalidResetLink />);

    expect(heading()).toBeInTheDocument();
    expect(
      screen.getByText(/Reset links can be used once/),
    ).toBeInTheDocument();
  });

  it("links to request a new link and back to sign in", () => {
    render(<InvalidResetLink />);

    expect(
      screen.getByRole("link", { name: "Request a new link" }),
    ).toHaveAttribute("href", "/forgot-password");
    expect(
      screen.getByRole("link", { name: "Back to sign in" }),
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
