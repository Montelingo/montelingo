import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { HomeControl } from "./HomeControl";

const { usePathname } = vi.hoisted(() => ({
  usePathname: vi.fn<() => string>(),
}));
vi.mock("next/navigation", () => ({ usePathname }));

function renderHome(pathname: string) {
  usePathname.mockReturnValue(pathname);
  return render(<HomeControl homeHref="/play" />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("HomeControl", () => {
  it("goes to the map", () => {
    renderHome("/play/kotor/old-town");

    const home = screen.getByRole("link", { name: "Home" });
    expect(home).toHaveAttribute("href", "/play");
    expect(home).not.toHaveAttribute("aria-current");
  });

  it.each(["/play", "/play/"])("is the current page on %j", (pathname) => {
    renderHome(pathname);

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("is reached from the keyboard", async () => {
    const user = userEvent.setup();
    renderHome("/play/kotor");

    await user.tab();

    expect(screen.getByRole("link", { name: "Home" })).toHaveFocus();
  });

  it.each(["/play", "/play/kotor"])(
    "has no accessibility violations on %j",
    async (pathname) => {
      const { container } = renderHome(pathname);

      expect(await axe(container)).toHaveNoViolations();
    },
  );
});
