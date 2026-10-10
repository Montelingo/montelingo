import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { SubmitButton } from "./SubmitButton";

type SignInFormProps = {
  pending?: boolean;
  onSubmit: () => void;
};

function SignInForm({ pending, onSubmit }: SignInFormProps) {
  return (
    <form
      aria-label="Sign in"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label htmlFor="email">Email</label>
      <input id="email" name="email" />
      <SubmitButton pending={pending} pendingLabel="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}

describe("SubmitButton", () => {
  it("submits its form when clicked", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<SignInForm onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("submits its form when Enter is pressed in a field", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<SignInForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("Email"), "ana@example.com{Enter}");

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("calls its click handler when not pending", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <form aria-label="Save" onSubmit={(event) => event.preventDefault()}>
        <SubmitButton onClick={onClick}>Save</SubmitButton>
      </form>,
    );

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("shows the pending label and stays focusable while pending", () => {
    render(<SignInForm pending onSubmit={vi.fn()} />);

    const button = screen.getByRole("button", { name: "Signing in…" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toBeDisabled();
    button.focus();
    expect(button).toHaveFocus();
  });

  it("does not submit when clicked while pending", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<SignInForm pending onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: "Signing in…" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not submit when Enter is pressed in a field while pending", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<SignInForm pending onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("Email"), "ana@example.com{Enter}");

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not submit when activated from the keyboard while pending", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<SignInForm pending onSubmit={onSubmit} />);

    screen.getByRole("button", { name: "Signing in…" }).focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("follows the pending state of its form action", async () => {
    const user = userEvent.setup();
    let finishAction: () => void = () => undefined;
    const action = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishAction = resolve;
        }),
    );
    render(
      <form aria-label="Save" action={action}>
        <SubmitButton>Save</SubmitButton>
      </form>,
    );

    await user.click(screen.getByRole("button", { name: "Save" }));

    const pendingButton = await screen.findByRole("button", {
      name: "Submitting…",
    });
    expect(pendingButton).toHaveAttribute("aria-disabled", "true");

    await user.click(pendingButton);
    expect(action).toHaveBeenCalledTimes(1);

    finishAction();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save" })).not.toHaveAttribute(
        "aria-disabled",
      );
    });
  });

  it.each([
    ["idle", false],
    ["pending", true],
  ])("has no accessibility violations when %s", async (_state, pending) => {
    const { container } = render(
      <SignInForm pending={pending} onSubmit={vi.fn()} />,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
