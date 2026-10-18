import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { BackControl } from "./BackControl";

const { usePathname } = vi.hoisted(() => ({
  usePathname: vi.fn<() => string>(),
}));
vi.mock("next/navigation", () => ({ usePathname }));

function renderBack(pathname: string) {
  usePathname.mockReturnValue(pathname);
  return render(<BackControl homeHref="/play" exitHref="/" />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BackControl", () => {
  it.each([
    ["/play", "/"],
    ["/play/kotor", "/play"],
    ["/play/kotor/old-town", "/play/kotor"],
  ])("on %j, goes back to %j", (pathname, expected) => {
    renderBack(pathname);

    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute(
      "href",
      expected,
    );
  });

  it("is reached from the keyboard", async () => {
    const user = userEvent.setup();
    renderBack("/play/kotor");

    await user.tab();

    expect(screen.getByRole("link", { name: "Back" })).toHaveFocus();
  });

  it("has no accessibility violations", async () => {
    const { container } = renderBack("/play/kotor");

    expect(await axe(container)).toHaveNoViolations();
  });
});
