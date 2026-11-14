import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { toMapData } from "../model/map-view";
import { newAccountProgress, seedRegionDetails } from "../test-fixtures";
import { LevelCard } from "./LevelCard";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

// jsdom has no modal dialogs: showModal() and close() open and close it, and
// close() fires `close`, as a browser does.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

const map = toMapData(seedRegionDetails(), newAccountProgress());

function renderAt(url: string) {
  window.history.replaceState(null, "", url);
  return render(<LevelCard regions={map.regions} places={map.places} />);
}

afterEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/");
});

describe("LevelCard", () => {
  it("shows nothing without a place in the URL", () => {
    renderAt("/play/coast");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens an open place's card, named by the place", () => {
    renderAt("/play/coast?place=budva");

    const card = screen.getByRole("dialog", { name: "Budva" });
    expect(card).toHaveAttribute("open");
    expect(card).toHaveTextContent("Obala · mjesto 1");
  });

  it("shows the place's stars, none earned yet", () => {
    renderAt("/play/coast?place=budva");

    expect(
      screen.getByRole("img", { name: "0 od 3 zvjezdice" }),
    ).toBeInTheDocument();
  });

  it("leads Kreni! into the place", () => {
    renderAt("/play/coast?place=budva");

    expect(screen.getByRole("link", { name: "Kreni!" })).toHaveAttribute(
      "href",
      "/play/coast/budva",
    );
  });

  it.each([
    ["a locked place", "kotor"],
    ["an unknown place", "atlantis"],
  ])("ignores %s in the URL", (_case, id) => {
    renderAt(`/play/coast?place=${id}`);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes by dropping the place from the URL", async () => {
    const user = userEvent.setup();
    renderAt("/play/coast?place=budva");

    await user.click(screen.getByRole("button", { name: "Zatvori" }));

    expect(router.replace).toHaveBeenCalledWith("/play/coast", {
      scroll: false,
    });
  });

  it("has no accessibility violations", async () => {
    const { container } = renderAt("/play/coast?place=budva");

    expect(await axe(container)).toHaveNoViolations();
  });
});
