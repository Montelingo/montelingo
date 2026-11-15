import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import type { ProgressResult } from "../model/progress";
import { toMapData } from "../model/map-view";
import { MAP_NOTICES, type MapNotice, withMapNotice } from "../model/notices";
import { toRegionScreen } from "../model/screens";
import {
  currentPath,
  newAccountProgress,
  seedRegionDetail,
  seedRegionDetails,
} from "../test-fixtures";
import { RegionScreen } from "./RegionScreen";

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

// Progress answered, but without an entry for the coast's places.
const UNCOVERED: ProgressResult = {
  status: "ready",
  progress: { regions: [{ id: "coast", state: "available" }], locations: [] },
};

function renderCoast(
  progress: ProgressResult = newAccountProgress(),
  notice: MapNotice | null = null,
) {
  const path = "/play/coast";
  window.history.replaceState(
    null,
    "",
    notice === null ? path : withMapNotice(path, notice),
  );
  const { region } = toRegionScreen(seedRegionDetail("coast"), progress);
  return render(
    <RegionScreen
      region={region}
      {...toMapData(seedRegionDetails(), progress)}
      notice={notice}
    />,
  );
}

function theMap() {
  return screen.getByRole("group", { name: "Mapa Crne Gore, regija Obala" });
}

afterEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/");
});

describe("RegionScreen", () => {
  it("is headed with the region's name", () => {
    renderCoast();

    expect(
      screen.getByRole("heading", { level: 1, name: "Obala" }),
    ).toBeInTheDocument();
  });

  it("shows the region's six places, numbered, Budva as the next stop", () => {
    renderCoast();

    const places = within(screen.getByRole("group", { name: "Mjesta" }))
      .getAllByRole("link")
      .map((link) => link.getAttribute("aria-label"));
    expect(places).toEqual([
      "Budva, otvoreno, sljedeće mjesto",
      "Kotor, zaključano",
      "Ulcinj, zaključano",
      "Herceg Novi, zaključano",
      "Tivat, zaključano",
      "Bar, zaključano",
    ]);
  });

  it("opens an open place's level card on the same page, without the router", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/play/coast");
    renderCoast();
    const budva = within(theMap()).getByRole("link", { name: /^Budva/ });

    expect(budva).toHaveAttribute("href", "/play/coast?place=budva");
    await user.click(budva);

    expect(currentPath()).toBe("/play/coast?place=budva");
    expect(router.push).not.toHaveBeenCalled();
  });

  it("says why a locked place will not open", async () => {
    const user = userEvent.setup();
    renderCoast();

    await user.click(
      within(theMap()).getByRole("link", { name: "Kotor, zaključano" }),
    );

    expect(router.push).not.toHaveBeenCalled();
    expect(screen.getByText("Mjesto Kotor još nije otvoreno.")).toBeVisible();
  });

  it("still shows the other regions, to go to", () => {
    renderCoast();

    expect(
      within(theMap()).getByRole("link", {
        name: "Centralna Crna Gora, zaključano",
      }),
    ).toBeInTheDocument();
  });

  it("leads Back to the whole map", () => {
    renderCoast();

    expect(screen.getByRole("link", { name: "Nazad" })).toHaveAttribute(
      "href",
      "/play",
    );
  });

  it("shows no notice and no retry when there is nothing to say", () => {
    renderCoast();

    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
  });

  it("says why the learner was sent back from a locked place", () => {
    renderCoast(newAccountProgress(), "location-locked");

    expect(screen.getByText(MAP_NOTICES["location-locked"])).toBeVisible();
  });

  it("offers a retry when progress could not be read, still showing the places", () => {
    renderCoast({ status: "error" });

    expect(
      within(theMap()).getByRole("link", { name: "Budva, nije učitano" }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  it("offers the same retry when progress has no state for its places", () => {
    renderCoast(UNCOVERED);

    expect(
      within(theMap()).getByRole("link", { name: "Budva, učitava se" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  it.each<[string, ProgressResult, MapNotice | null]>([
    ["a new account", newAccountProgress(), null],
    ["a notice", newAccountProgress(), "location-locked"],
    ["failed progress", { status: "error" }, null],
  ])(
    "has no accessibility violations for %s",
    async (_case, progress, notice) => {
      const { container } = renderCoast(progress, notice);

      expect(await axe(container)).toHaveNoViolations();
    },
  );
});
