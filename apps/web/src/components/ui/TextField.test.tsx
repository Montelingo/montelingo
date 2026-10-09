import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { TextField } from "./TextField";

describe("TextField", () => {
  it("labels the input", () => {
    render(<TextField label="Email" name="email" type="email" />);

    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("type", "email");
    expect(input).toHaveAttribute("name", "email");
  });

  it("passes typed text to the change handler", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TextField label="Email" onChange={onChange} />);

    await user.type(screen.getByLabelText("Email"), "ana@example.com");

    expect(screen.getByLabelText("Email")).toHaveValue("ana@example.com");
    expect(onChange).toHaveBeenCalledTimes("ana@example.com".length);
  });

  it("is valid and undescribed by default", () => {
    render(<TextField label="Email" />);

    const input = screen.getByLabelText("Email");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
  });

  it("describes the input with its description", () => {
    render(<TextField label="Email" description="We never share it." />);

    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription(
      "We never share it.",
    );
  });

  it("marks the input invalid and describes it with the error", () => {
    render(
      <TextField
        label="Email"
        description="We never share it."
        error="Enter a valid email address."
      />,
    );

    const input = screen.getByLabelText("Email");
    expect(input).toBeInvalid();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(
      "We never share it. Enter a valid email address.",
    );
  });

  it("announces an error that contains a link", () => {
    render(
      <TextField
        label="Email"
        error={
          <>
            This email is taken. <a href="/sign-in">Sign in instead</a>
          </>
        }
      />,
    );

    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription(
      "This email is taken. Sign in instead",
    );
    expect(
      screen.getByRole("link", { name: "Sign in instead" }),
    ).toHaveAttribute("href", "/sign-in");
  });

  it("treats an empty error as no error", () => {
    render(<TextField label="Email" error="" />);

    const input = screen.getByLabelText("Email");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
  });

  it("keeps descriptions the caller adds", () => {
    render(
      <>
        <p id="email-hint">Use your school address.</p>
        <TextField
          label="Email"
          aria-describedby="email-hint"
          error="Enter a valid email address."
        />
      </>,
    );

    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription(
      "Use your school address. Enter a valid email address.",
    );
  });

  it("uses a caller-provided id", () => {
    render(<TextField label="Email" id="sign-in-email" error="Required." />);

    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("id", "sign-in-email");
    expect(input).toHaveAttribute("aria-describedby", "sign-in-email-error");
  });

  it("renders an end adornment next to the input", () => {
    render(
      <TextField
        label="Search"
        endAdornment={<button type="button">Clear</button>}
      />,
    );

    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
    expect(screen.getByLabelText("Search")).toBeInTheDocument();
  });

  it.each([
    ["default", {}],
    ["with a description", { description: "We never share it." }],
    ["with an error", { error: "Enter a valid email address." }],
  ])("has no accessibility violations %s", async (_state, props) => {
    const { container } = render(<TextField label="Email" {...props} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
