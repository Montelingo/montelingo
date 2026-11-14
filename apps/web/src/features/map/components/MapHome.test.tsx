import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { type MapData, toMapData } from "../model/map-view";
import { MAP_NOTICES, type MapNotice, withMapNotice } from "../model/notices";
import { newAccountProgress, seedRegionDetails } from "../test-fixtures";
import { MapHome } from "./MapHome";

const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

// useSearchParams() returns the URL as it is now, like Next.js, whose router
// follows history.replaceState().
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

const newAccount = toMapData(seedRegionDetails(), newAccountProgress());
const failed = toMapData(seedRegionDetails(), { status: "error" });
// Progress answered, but without an entry for the north.
const uncovered = toMapData(seedRegionDetails(), {
  status: "ready",
  progress: {
    regions: [
      { id: "coast", state: "available" },
      { id: "central", state: "locked" },
    ],
    locations: [{ id: "budva", state: "available" }],
  },
});

function renderHome(
  map: MapData = newAccount,
  notice: MapNotice | null = null,
) {
  // The page shows a notice it read from its URL.
  const path = "/play";
  window.history.replaceState(
    null,
    "",
    notice === null ? path : withMapNotice(path, notice),
  );
  return render(<MapHome {...map} notice={notice} />);
}

function theMap() {
  return screen.getByRole("group", { name: "Mapa Crne Gore" });
}

afterEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/");
});

describe("MapHome", () => {
  it("is headed as the learner's map", () => {
    renderHome();

    expect(
      screen.getByRole("heading", { level: 1, name: "Mapa" }),
    ).toBeInTheDocument();
  });

  it("shows every region on the map, only the coast open for a new account", () => {
    renderHome();

    const regions = within(theMap()).getAllByRole("link");
    expect(regions.map((link) => link.getAttribute("aria-label"))).toEqual([
      "Obala, otvoreno",
      "Centralna Crna Gora, zaključano",
      "Sjever i planine, zaključano",
    ]);
    expect(regions[0]).toHaveAttribute("href", "/play/coast");
    expect(regions[1]).not.toHaveAttribute("href");
    expect(regions[1]).toHaveAttribute("aria-disabled", "true");
  });

  it("opens an open region by its link, through the router", async () => {
    const user = userEvent.setup();
    renderHome();

    await user.click(
      within(theMap()).getByRole("link", { name: "Obala, otvoreno" }),
    );

    expect(router.push).toHaveBeenCalledWith("/play/coast");
  });

  it("says why a locked region will not open, every time it is tapped", async () => {
    const user = userEvent.setup();
    renderHome();
    const central = within(theMap()).getByRole("link", {
      name: "Centralna Crna Gora, zaključano",
    });

    await user.click(central);
    await user.click(central);

    expect(router.push).not.toHaveBeenCalled();
    expect(
      screen.getByText("Regija Centralna Crna Gora još nije otvorena."),
    ).toBeVisible();
  });

  it("shows no place to open on the whole map, only regions", () => {
    renderHome();

    expect(
      within(theMap()).queryByRole("link", { name: /^Budva/ }),
    ).not.toBeInTheDocument();
  });

  it("leads Back out of the learner area", () => {
    renderHome();

    expect(screen.getByRole("link", { name: "Nazad" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("shows the next place's region, stars and hearts in the top bar", () => {
    renderHome();

    expect(
      screen.getByRole("group", { name: "Obala: 0 od 6 mjesta" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Zvjezdice: 0" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Srca: 0" })).toBeInTheDocument();
  });

  it("lists the regions in the side panel, the locked ones only as locked", () => {
    renderHome();

    const panel = screen.getByRole("complementary", { name: "Regije" });
    expect(within(panel).getByRole("link", { name: /Obala/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(panel).getByText("0 od 6 mjesta")).toBeInTheDocument();
    expect(within(panel).getAllByText("Još zaključano")).toHaveLength(2);
  });

  it("opens the next stop's level card from its play button", () => {
    renderHome();

    // Once in the side panel and once above the bottom nav: CSS shows one.
    for (const play of screen.getAllByRole("link", { name: "Otvori: Budva" })) {
      expect(play).toHaveAttribute("href", "/play/coast?place=budva");
    }
  });

  it("has the map tab current and says the others are coming", async () => {
    const user = userEvent.setup();
    renderHome();
    const nav = screen.getByRole("navigation", { name: "Glavni meni" });

    expect(within(nav).getByRole("link", { name: "Mapa" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await user.click(within(nav).getByRole("button", { name: "Riječi" }));

    expect(screen.getByText("Riječi: uskoro!")).toBeVisible();
  });

  it("shows no notice and no retry when there is nothing to say", () => {
    renderHome();

    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(MAP_NOTICES["region-locked"]),
    ).not.toBeInTheDocument();
  });

  it("says why the learner was sent back from a locked region", () => {
    renderHome(newAccount, "region-locked");

    expect(screen.getByText(MAP_NOTICES["region-locked"])).toBeVisible();
  });

  it("offers a retry when progress could not be read, still showing the regions", () => {
    renderHome(failed);

    expect(
      within(theMap()).getByRole("link", { name: "Obala, nije učitano" }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  it("offers the same retry when progress has no state for a region", () => {
    renderHome(uncovered);

    expect(
      within(theMap()).getByRole("link", {
        name: "Sjever i planine, učitava se",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  it.each<[string, MapData, MapNotice | null]>([
    ["a new account", newAccount, null],
    ["a notice", newAccount, "region-locked"],
    ["failed progress", failed, null],
  ])("has no accessibility violations for %s", async (_case, map, notice) => {
    const { container } = renderHome(map, notice);

    expect(await axe(container)).toHaveNoViolations();
  });
});
