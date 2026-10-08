import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { PasswordField } from "./PasswordField";

describe("PasswordField", () => {
  it("hides the password by default", () => {
    render(<PasswordField label="Password" />);

    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "type",
      "password",
    );
    expect(
      screen.getByRole("button", { name: "Show password", pressed: false }),
    ).toBeInTheDocument();
  });

  it("shows and hides the password with the toggle", async () => {
    const user = userEvent.setup();
    render(<PasswordField label="Password" />);
    const input = screen.getByLabelText("Password");
    await user.type(input, "correct horse");

    await user.click(screen.getByRole("button", { name: "Show password" }));

    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveValue("correct horse");
    expect(
      screen.getByRole("button", { name: "Show password", pressed: true }),
    ).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Show password" }));

    expect(input).toHaveAttribute("type", "password");
    expect(
      screen.getByRole("button", { name: "Show password", pressed: false }),
    ).toBeInTheDocument();
  });

  it("toggles from the keyboard", async () => {
    const user = userEvent.setup();
    render(<PasswordField label="Password" />);

    await user.tab();
    expect(screen.getByLabelText("Password")).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Show password" })).toHaveFocus();
    await user.keyboard(" ");

    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
  });

  it("does not submit the form when toggled", async () => {
    const user = userEvent.setup();
    let submitCount = 0;
    render(
      <form
        aria-label="Sign in"
        onSubmit={(event) => {
          event.preventDefault();
          submitCount += 1;
        }}
      >
        <PasswordField label="Password" />
      </form>,
    );

    await user.click(screen.getByRole("button", { name: "Show password" }));

    expect(submitCount).toBe(0);
  });

  it("controls the input it toggles", () => {
    render(<PasswordField label="Password" id="sign-in-password" />);

    expect(
      screen.getByRole("button", { name: "Show password" }),
    ).toHaveAttribute("aria-controls", "sign-in-password");
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "id",
      "sign-in-password",
    );
  });

  it("autocompletes the current password unless told otherwise", () => {
    const { rerender } = render(<PasswordField label="Password" />);
    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("autocomplete", "current-password");
    expect(input).toHaveAttribute("autocapitalize", "none");
    expect(input).toHaveAttribute("spellcheck", "false");

    rerender(<PasswordField label="Password" autoComplete="new-password" />);

    expect(input).toHaveAttribute("autocomplete", "new-password");
  });

  it("wires its error to the input", () => {
    render(
      <PasswordField label="Password" error="Use at least 8 characters." />,
    );

    const input = screen.getByLabelText("Password");
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription("Use at least 8 characters.");
  });

  it("has no accessibility violations while hidden", async () => {
    const { container } = render(<PasswordField label="Password" />);

    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no accessibility violations while shown with an error", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <PasswordField label="Password" error="Use at least 8 characters." />,
    );
    await user.click(screen.getByRole("button", { name: "Show password" }));

    expect(await axe(container)).toHaveNoViolations();
  });
});
