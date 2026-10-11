import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { ErrorFallback } from "./ErrorFallback";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

function renderFallback() {
  const reset = vi.fn();
  const view = render(
    <ErrorFallback title="We couldn’t load this page." reset={reset} />,
  );
  return { ...view, reset };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ErrorFallback", () => {
  it("announces the title as an alert", () => {
    renderFallback();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "We couldn’t load this page.",
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "We couldn’t load this page.",
      }),
    ).toBeInTheDocument();
  });

  it("refetches the page and resets the boundary on retry", async () => {
    const user = userEvent.setup();
    const { reset } = renderFallback();

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("has no accessibility violations", async () => {
    const { container } = renderFallback();

    expect(await axe(container)).toHaveNoViolations();
  });
});
