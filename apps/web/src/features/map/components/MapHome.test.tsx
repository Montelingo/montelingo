import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { type MapData, toMapData } from "../model/map-view";
import { MAP_NOTICES, type MapNotice, withMapNotice } from "../model/notices";
import {
  advanceTimers,
  newAccountProgress,
  seedRegionDetails,
  tap,
} from "../test-fixtures";
import { MapHome } from "./MapHome";
import { MESSAGE_HIDE_DELAY_MS } from "./use-hide-message";

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

  describe("hiding its messages", () => {
    const centralLocked = "Regija Centralna Crna Gora još nije otvorena.";
    const northLocked = "Regija Sjever i planine još nije otvorena.";
    const regionNotice = MAP_NOTICES["region-locked"];

    function link(name: string) {
      return within(theMap()).getByRole("link", { name });
    }

    // The map's own status region, beside it.
    function mapStatus() {
      const frame = theMap().parentElement;
      if (frame === null) {
        throw new Error("Expected the map in its frame.");
      }
      return within(frame).getByRole("status");
    }

    function noticeText() {
      return screen.queryByText(regionNotice, { selector: "p" });
    }

    // A notice from the URL is announced, and can hide, a moment after mount.
    function announceNotices() {
      advanceTimers(100);
    }

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("hides a locked region's message after a few seconds, keeping its status region", () => {
      renderHome();

      tap(link("Centralna Crna Gora, zaključano"));
      advanceTimers(MESSAGE_HIDE_DELAY_MS - 1);
      expect(screen.getByText(centralLocked)).toBeVisible();
      advanceTimers(1);

      expect(screen.queryByText(centralLocked)).not.toBeInTheDocument();
      expect(mapStatus()).toBeEmptyDOMElement();
    });

    it("hides it at a tap anywhere, and that tap does nothing else", () => {
      renderHome();

      tap(link("Centralna Crna Gora, zaključano"));
      tap(link("Obala, otvoreno"));

      expect(screen.queryByText(centralLocked)).not.toBeInTheDocument();
      expect(router.push).not.toHaveBeenCalled();
      // The next tap is an ordinary one again.
      tap(link("Obala, otvoreno"));
      expect(router.push).toHaveBeenCalledWith("/play/coast");
    });

    it("hides it at a tap on the empty map", () => {
      renderHome();

      tap(link("Centralna Crna Gora, zaključano"));
      tap(theMap());

      expect(screen.queryByText(centralLocked)).not.toBeInTheDocument();
    });

    it("replaces it with another locked region's, which starts the delay again", () => {
      renderHome();

      tap(link("Centralna Crna Gora, zaključano"));
      advanceTimers(MESSAGE_HIDE_DELAY_MS - 1000);
      tap(link("Sjever i planine, zaključano"));

      expect(screen.queryByText(centralLocked)).not.toBeInTheDocument();
      expect(mapStatus()).toHaveTextContent(northLocked);
      advanceTimers(MESSAGE_HIDE_DELAY_MS - 1);
      expect(screen.getByText(northLocked)).toBeVisible();
      advanceTimers(1);
      expect(screen.queryByText(northLocked)).not.toBeInTheDocument();
    });

    it("says it anew when the same region is tapped again", () => {
      renderHome();
      const central = link("Centralna Crna Gora, zaključano");

      tap(central);
      const first = screen.getByText(centralLocked);
      tap(central);

      expect(screen.getByText(centralLocked)).not.toBe(first);
      expect(mapStatus().children).toHaveLength(1);
    });

    it("says it again after it has hidden", () => {
      renderHome();
      const central = link("Centralna Crna Gora, zaključano");

      tap(central);
      advanceTimers(MESSAGE_HIDE_DELAY_MS);
      tap(central);

      expect(screen.getByText(centralLocked)).toBeVisible();
    });

    it("lets the keyboard through", () => {
      renderHome();

      tap(link("Centralna Crna Gora, zaključano"));
      fireEvent.keyDown(link("Obala, otvoreno"), { key: "Enter" });

      expect(router.push).toHaveBeenCalledWith("/play/coast");
    });

    it("hides the notice from the URL after a few seconds", () => {
      renderHome(newAccount, "region-locked");
      announceNotices();

      advanceTimers(MESSAGE_HIDE_DELAY_MS - 1);
      expect(noticeText()).toBeVisible();
      advanceTimers(1);

      expect(noticeText()).not.toBeInTheDocument();
    });

    it("says why a locked region will not open while the notice shows", () => {
      renderHome(newAccount, "region-locked");
      announceNotices();

      tap(link("Centralna Crna Gora, zaključano"));

      expect(screen.getByText(centralLocked)).toBeVisible();
      expect(noticeText()).toBeVisible();
    });

    it("keeps the retry until it is tapped away, and lets it work while other messages show", () => {
      renderHome(failed, "region-locked");
      tap(link("Obala, nije učitano"));
      const lockedCoast = "Regija Obala još nije otvorena.";
      announceNotices();
      const retry = screen.getByRole("button", { name: "Try again" });

      tap(retry);

      expect(router.refresh).toHaveBeenCalledTimes(1);
      expect(screen.getByText(lockedCoast)).toBeVisible();
      expect(noticeText()).toBeVisible();

      advanceTimers(MESSAGE_HIDE_DELAY_MS * 10);
      expect(screen.queryByText(lockedCoast)).not.toBeInTheDocument();
      expect(noticeText()).not.toBeInTheDocument();
      expect(retry).toBeVisible();

      tap(theMap());
      expect(retry).not.toBeInTheDocument();
      expect(router.refresh).toHaveBeenCalledTimes(1);
    });
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

  it("shows the placeholder explorer until the profile is set up", () => {
    renderHome();

    const panel = screen.getByRole("complementary", { name: "Regije" });
    expect(within(panel).getByText("Istraživač")).toBeInTheDocument();
  });

  it("shows the child's name and title once the profile is set up", () => {
    renderHome({
      ...newAccount,
      explorer: {
        name: "Mia",
        avatar: "owl",
        title: "Istraživač · 5–6 godina",
      },
    });

    const panel = screen.getByRole("complementary", { name: "Regije" });
    expect(within(panel).getByText("Mia")).toBeInTheDocument();
    expect(
      within(panel).getByText("Istraživač · 5–6 godina"),
    ).toBeInTheDocument();
    expect(
      panel.querySelector('img[src="/learner/avatar-owl.svg"]'),
    ).not.toBeNull();
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
