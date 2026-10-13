import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AuthSubmitButton } from "./AuthSubmitButton";

type FormProps = {
  isPending?: boolean;
  retryAfterSeconds?: number | null;
  onSubmit?: () => void;
};

function Form({
  isPending = false,
  retryAfterSeconds = null,
  onSubmit = () => undefined,
}: FormProps) {
  return (
    <form
      aria-label="Sign in"
      method="post"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label htmlFor="email">Email</label>
      <input id="email" name="email" />
      <AuthSubmitButton
        isPending={isPending}
        pendingLabel="Signing in…"
        retryAfterSeconds={retryAfterSeconds}
      >
        Sign in
      </AuthSubmitButton>
    </form>
  );
}

function serverHtml(element: ReactElement): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = renderToString(element);
  return container;
}

describe("AuthSubmitButton", () => {
  // Before hydration nothing handles the submit: a native one would post the
  // values to the page route and lose them.
  it("is disabled in the server HTML", () => {
    const button = within(serverHtml(<Form />)).getByRole("button", {
      name: "Sign in",
    });

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("type", "submit");
  });

  it("is enabled once the page hydrates", () => {
    const container = serverHtml(<Form />);
    document.body.append(container);
    const onRecoverableError = vi.fn();
    expect(
      within(container).getByRole("button", { name: "Sign in" }),
    ).toBeDisabled();

    let root: Root | undefined;
    act(() => {
      root = hydrateRoot(container, <Form />, { onRecoverableError });
    });

    expect(
      within(container).getByRole("button", { name: "Sign in" }),
    ).toBeEnabled();
    expect(onRecoverableError).not.toHaveBeenCalled();
    act(() => {
      root?.unmount();
    });
    container.remove();
  });

  it("submits when clicked in the browser", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Form onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("is held, not disabled, while pending", () => {
    render(<Form isPending />);

    const button = screen.getByRole("button", { name: "Signing in…" });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("aria-disabled", "true");
  });

  it("counts down while the API's Retry-After runs", () => {
    render(<Form retryAfterSeconds={75} />);

    const button = screen.getByRole("button", { name: "Try again in 1:15" });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("aria-disabled", "true");
  });
});
