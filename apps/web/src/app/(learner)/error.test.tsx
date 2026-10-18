import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import LearnerError from "./error";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

function renderError() {
  const reset = vi.fn();
  const view = render(
    <LearnerError
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

describe("LearnerError", () => {
  it("explains calmly that the problem is on our side", () => {
    renderError();

    const alert = screen.getByRole("alert");
    expect(
      screen.getByRole("heading", { level: 1, name: "This page didn’t open." }),
    ).toBeInTheDocument();
    expect(alert).toHaveTextContent(
      "Something went wrong on our side. Let’s try again.",
    );
    // Nothing that suggests the learner or their device is to blame.
    expect(alert).not.toHaveTextContent(/your connection|you|wrong answer/i);
    expect(screen.queryByText(/secret server detail/)).not.toBeInTheDocument();
  });

  it("refetches the page and resets the boundary on retry", async () => {
    const user = userEvent.setup();
    const { reset } = renderError();

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("retries from the keyboard", async () => {
    const user = userEvent.setup();
    const { reset } = renderError();

    await user.tab();
    await user.keyboard("{Enter}");

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("has no accessibility violations", async () => {
    const { container } = renderError();

    expect(await axe(container)).toHaveNoViolations();
  });
});
