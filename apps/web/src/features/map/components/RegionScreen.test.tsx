import { render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { MAP_NOTICES, type MapNotice } from "../model/notices";
import { type RegionScreenData, toRegionScreen } from "../model/screens";
import { newAccountProgress, seedRegionDetail } from "../test-fixtures";
import { RegionScreen } from "./RegionScreen";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const newAccountCoast = toRegionScreen(
  seedRegionDetail("coast"),
  newAccountProgress(),
);
const failedCoast = toRegionScreen(seedRegionDetail("coast"), {
  status: "error",
});
// Progress answered, but without an entry for the coast's places.
const uncoveredCoast = toRegionScreen(seedRegionDetail("coast"), {
  status: "ready",
  progress: { regions: [{ id: "coast", state: "available" }], locations: [] },
});

function renderScreen(
  data: RegionScreenData = newAccountCoast,
  notice: MapNotice | null = null,
) {
  return render(<RegionScreen {...data} notice={notice} />);
}

describe("RegionScreen", () => {
  it("is headed with the region's name", () => {
    renderScreen();

    expect(
      screen.getByRole("heading", { level: 1, name: "Obala" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Obala" })).toBeInTheDocument();
  });

  it("shows the region's six places, Budva as the next stop", () => {
    renderScreen();

    const places = within(screen.getByRole("list", { name: "Places" }));
    expect(places.getAllByRole("listitem")).toHaveLength(6);
    expect(
      places.getByRole("link", { name: "Budva, Open, Next stop" }),
    ).toHaveAttribute("href", "/play/coast/budva");
  });

  it("shows no notice and no retry when there is nothing to say", () => {
    renderScreen();

    expect(
      screen.queryByText(MAP_NOTICES["location-locked"]),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
  });

  it("says why the learner was sent back from a locked place", async () => {
    renderScreen(newAccountCoast, "location-locked");

    expect(screen.getByText(MAP_NOTICES["location-locked"])).toBeVisible();
    await waitFor(() => {
      expect(
        screen
          .getAllByRole("status")
          .some((status) =>
            status.textContent?.includes(MAP_NOTICES["location-locked"]),
          ),
      ).toBe(true);
    });
  });

  it("offers a retry when progress could not be read, still showing the places", () => {
    renderScreen(failedCoast);

    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("list", { name: "Places" })).getAllByRole(
        "listitem",
      ),
    ).toHaveLength(6);
    expect(screen.queryByText("Next stop")).not.toBeInTheDocument();
  });

  it("offers the same retry when progress has no state for its places", () => {
    renderScreen(uncoveredCoast);

    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Budva, Loading" }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it.each<[string, Parameters<typeof renderScreen>]>([
    ["for a new account", [newAccountCoast, null]],
    ["with a notice", [newAccountCoast, "location-locked"]],
    ["when progress failed", [failedCoast, null]],
    ["when progress has no state for its places", [uncoveredCoast, null]],
  ])("has no accessibility violations %s", async (_case, args) => {
    const { container } = renderScreen(...args);

    expect(await axe(container)).toHaveNoViolations();
  });
});
