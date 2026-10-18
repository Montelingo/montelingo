import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import AuthError from "./error";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

function renderError() {
  const reset = vi.fn();
  const view = render(
    <AuthError
      error={Object.assign(new Error("secret server detail"), {
        digest: "123",
      })}
      reset={reset}
    />,
  );
  return { ...view, reset };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AuthError", () => {
  it("explains the failure without the server's message", () => {
    renderError();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "We couldn’t load this page.",
    );
    expect(screen.queryByText(/secret server detail/)).not.toBeInTheDocument();
  });

  it("refetches the page and resets the boundary on retry", async () => {
    const user = userEvent.setup();
    const { reset } = renderError();

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("has no accessibility violations", async () => {
    const { container } = renderError();

    expect(await axe(container)).toHaveNoViolations();
  });
});
