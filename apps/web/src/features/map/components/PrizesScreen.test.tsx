import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import type { ProgressResult } from "../model/progress";
import { toPrizesData } from "../model/prizes";
import { seedRegionDetails, seedRegions } from "../test-fixtures";
import { PrizesScreen } from "./PrizesScreen";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

// The coast started (Budva done), the centre and the north locked.
const BUDVA_DONE: ProgressResult = {
  status: "ready",
  progress: {
    regions: [
      { id: "coast", state: "in-progress" },
      { id: "central", state: "locked" },
      { id: "north", state: "locked" },
    ],
    locations: [
      { id: "budva", state: "completed" },
      { id: "kotor", state: "available" },
      { id: "ulcinj", state: "locked" },
      { id: "herceg-novi", state: "locked" },
      { id: "tivat", state: "locked" },
      { id: "bar", state: "locked" },
    ],
    chapters: [],
  },
};

function renderPrizes(
  progress: ProgressResult = BUDVA_DONE,
  stars: { stars?: number; regionStars?: Record<string, number> } = {},
) {
  return render(
    <PrizesScreen
      {...toPrizesData(seedRegions(), seedRegionDetails(), progress)}
      stars={stars.stars ?? 0}
      regionStars={stars.regionStars ?? {}}
    />,
  );
}

function region(name: string) {
  return screen.getByRole("region", { name });
}

describe("PrizesScreen", () => {
  it("is titled, with the star counter", () => {
    renderPrizes(BUDVA_DONE, { stars: 6 });

    expect(
      screen.getByRole("heading", { level: 1, name: "Moje nagrade" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Zvjezdice: 6" }),
    ).toBeInTheDocument();
  });

  it("shows an open region's stars out of three per place", () => {
    renderPrizes(BUDVA_DONE, { regionStars: { coast: 6 } });

    expect(
      within(region("Obala")).getByRole("group", {
        name: "Zvjezdice: 6 od 18",
      }),
    ).toBeInTheDocument();
  });

  it("counts a region's stars as 0 until the server sends them", () => {
    renderPrizes();

    expect(
      within(region("Obala")).getByRole("group", {
        name: "Zvjezdice: 0 od 18",
      }),
    ).toBeInTheDocument();
  });

  it("shows a sticker per place in content order, named", () => {
    renderPrizes();

    const stickers = within(region("Obala")).getAllByRole("listitem");
    expect(stickers.map((sticker) => sticker.textContent)).toEqual([
      "Budva, osvojena",
      "Kotor, još nije osvojena",
      "Ulcinj, još nije osvojena",
      "Herceg Novi, još nije osvojena",
      "Tivat, još nije osvojena",
      "Bar, još nije osvojena",
    ]);
  });

  it("draws an earned sticker in colour, without a lock", () => {
    renderPrizes();

    const budva = within(region("Obala")).getByText("Budva").closest("li");
    expect(budva).toHaveAttribute("data-earned", "true");
    expect(budva?.querySelector('img[src*="icon-lock"]')).toBeNull();
  });

  it("draws a sticker not earned yet faded, with the lock on it", () => {
    renderPrizes();

    const kotor = within(region("Obala")).getByText("Kotor").closest("li");
    expect(kotor).toHaveAttribute("data-earned", "false");
    expect(kotor?.querySelector('img[src*="icon-lock"]')).not.toBeNull();
  });

  it("shows a locked region's name and how many stickers it hides, and no stickers", () => {
    renderPrizes();

    const north = region("Sjever i planine (zaključano)");
    expect(
      within(north).getByText("6 naljepnica se krije u oblacima"),
    ).toBeInTheDocument();
    expect(within(north).queryAllByRole("listitem")).toEqual([]);
    expect(
      within(region("Centralna Crna Gora (zaključano)")).getByText(
        "5 naljepnica se krije u oblacima",
      ),
    ).toBeInTheDocument();
  });

  it("shows Nagrade as the current tab, with Mapa linking back to the map", () => {
    renderPrizes();

    const nav = screen.getByRole("navigation", { name: "Glavni meni" });
    expect(within(nav).getByRole("link", { name: "Nagrade" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    const map = within(nav).getByRole("link", { name: "Mapa" });
    expect(map).toHaveAttribute("href", "/play");
    expect(map).not.toHaveAttribute("aria-current");
  });

  it("still says Riječi is coming", async () => {
    renderPrizes();

    await userEvent.click(screen.getByRole("button", { name: "Riječi" }));

    expect(await screen.findByText("Riječi: uskoro!")).toBeInTheDocument();
  });

  it("offers a retry when progress failed", () => {
    renderPrizes({ status: "error" });

    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });

  it("does not offer a retry when progress loaded", () => {
    renderPrizes();

    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = renderPrizes();

    expect(await axe(container)).toHaveNoViolations();
  });
});
