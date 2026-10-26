import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { LearnerShell } from "./LearnerShell";

const { usePathname } = vi.hoisted(() => ({
  usePathname: vi.fn<() => string>(),
}));
vi.mock("next/navigation", () => ({ usePathname }));

function renderShell(pathname: string) {
  usePathname.mockReturnValue(pathname);
  return render(
    <LearnerShell homeHref="/play" exitHref="/">
      <h1>Your map</h1>
    </LearnerShell>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("LearnerShell", () => {
  it("puts the page in the main landmark the skip link targets", () => {
    renderShell("/play");

    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main-content");
    expect(main).toContainElement(
      screen.getByRole("heading", { name: "Your map" }),
    );
  });

  it("has no site header, only its own Back and Home controls", () => {
    renderShell("/play/kotor");

    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Learner" });
    expect(within(nav).getByRole("link", { name: "Back" })).toHaveAttribute(
      "href",
      "/play",
    );
    expect(within(nav).getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/play",
    );
  });

  it("leads out of the area from the map", () => {
    renderShell("/play");

    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("reaches Back, then Home, then the page from the keyboard", async () => {
    const user = userEvent.setup();
    usePathname.mockReturnValue("/play/kotor");
    render(
      <LearnerShell homeHref="/play" exitHref="/">
        <a href="/elsewhere/old-town">Old Town</a>
      </LearnerShell>,
    );

    await user.tab();
    expect(screen.getByRole("link", { name: "Back" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("link", { name: "Home" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("link", { name: "Old Town" })).toHaveFocus();
  });

  it.each(["/play", "/play/kotor"])(
    "has no accessibility violations on %j",
    async (pathname) => {
      const { container } = renderShell(pathname);

      expect(await axe(container)).toHaveNoViolations();
    },
  );
});
