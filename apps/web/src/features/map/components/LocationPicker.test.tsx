import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { MAP_ELEMENT_STATES, type MapElementState } from "../model/map-state";
import { toRegionScreen } from "../model/screens";
import {
  makeLocationPickerLocation,
  newAccountProgress,
  seedRegionDetail,
} from "../test-fixtures";
import { LocationPicker } from "./LocationPicker";

// The badge each state shows (TileCard's labels), and whether it opens.
const STATES: ReadonlyArray<readonly [MapElementState, string, boolean]> = [
  ["locked", "Locked", false],
  ["available", "Open", true],
  ["active", "Current", true],
  ["in-progress", "In progress", true],
  ["completed", "Done", true],
  ["loading", "Loading", false],
  ["error", "Not loaded", false],
];

function newAccountLocations(regionId: "coast" | "central" | "north") {
  return toRegionScreen(seedRegionDetail(regionId), newAccountProgress())
    .locations;
}

function placeList() {
  return screen.getByRole("list", { name: "Places" });
}

// There is no router in tests, so a followed link would make jsdom attempt a
// real navigation. The tests assert the href and the callback instead.
function preventNavigation(event: MouseEvent) {
  event.preventDefault();
}

beforeEach(() => {
  document.addEventListener("click", preventNavigation);
});

afterEach(() => {
  document.removeEventListener("click", preventNavigation);
});

describe("LocationPicker", () => {
  it("covers every map state", () => {
    expect(STATES.map(([state]) => state).sort()).toEqual(
      [...MAP_ELEMENT_STATES].sort(),
    );
  });

  describe("on the coast, for a new account", () => {
    it("opens Budva as the next stop and keeps the other five locked, in content order", () => {
      render(<LocationPicker locations={newAccountLocations("coast")} />);

      const cards = within(placeList()).getAllByRole("link");
      expect(cards.map((card) => card.getAttribute("aria-label"))).toEqual([
        "Budva, Open, Next stop",
        "Kotor, Locked",
        "Ulcinj, Locked",
        "Herceg Novi, Locked",
        "Tivat, Locked",
        "Bar, Locked",
      ]);
      expect(screen.getAllByText("Next stop")).toHaveLength(1);
    });

    it("links Budva to its screen under the region", () => {
      render(<LocationPicker locations={newAccountLocations("coast")} />);

      expect(
        screen.getByRole("link", { name: "Budva, Open, Next stop" }),
      ).toHaveAttribute("href", "/play/coast/budva");
    });

    it("says calmly that a tapped locked place isn’t open yet", async () => {
      const user = userEvent.setup();
      render(<LocationPicker locations={newAccountLocations("coast")} />);

      await user.click(screen.getByRole("link", { name: "Kotor, Locked" }));

      expect(screen.getByText("Kotor isn’t open yet.")).toBeInTheDocument();
    });

    it("has no accessibility violations", async () => {
      const { container } = render(
        <LocationPicker locations={newAccountLocations("coast")} />,
      );

      expect(await axe(container)).toHaveNoViolations();
    });
  });

  it.each([
    ["central", 5],
    ["north", 6],
  ] as const)("shows all %s locations, every one locked", (regionId, count) => {
    render(<LocationPicker locations={newAccountLocations(regionId)} />);

    const cards = within(placeList()).getAllByRole("link");
    expect(cards).toHaveLength(count);
    cards.forEach((card) => {
      expect(card).toHaveAttribute("aria-disabled", "true");
    });
    expect(screen.queryByText("Next stop")).not.toBeInTheDocument();
  });

  it("draws towns and other places the same way", () => {
    render(
      <LocationPicker
        locations={[
          makeLocationPickerLocation({ id: "podgorica", name: "Podgorica" }),
          makeLocationPickerLocation({
            id: "skadar-lake",
            name: "Skadarsko jezero",
          }),
        ]}
      />,
    );

    expect(
      within(placeList())
        .getAllByRole("link")
        .map((card) => card.getAttribute("aria-label")),
    ).toEqual(["Podgorica, Open", "Skadarsko jezero, Open"]);
  });

  describe.each(STATES)("with a %s location", (state, label, isOpen) => {
    function renderLocation(
      onLocationSelect?: (locationId: string) => void,
      isNext = false,
    ) {
      return render(
        <LocationPicker
          locations={[makeLocationPickerLocation({ state, isNext })]}
          onLocationSelect={onLocationSelect}
        />,
      );
    }

    it(`shows its name and a "${label}" badge`, () => {
      renderLocation();

      expect(screen.getByText("Budva")).toBeVisible();
      expect(screen.getByText(label)).toBeVisible();
      expect(screen.getByRole("link")).toHaveAccessibleName(`Budva, ${label}`);
    });

    if (isOpen) {
      it("is a real link to the location, and reports the selection", async () => {
        const user = userEvent.setup();
        const onLocationSelect = vi.fn();
        renderLocation(onLocationSelect);

        const card = screen.getByRole("link");
        expect(card).toHaveAttribute("href", "/play/coast/budva");
        await user.click(card);

        expect(onLocationSelect).toHaveBeenCalledTimes(1);
        expect(onLocationSelect).toHaveBeenCalledWith("budva");
      });
    } else {
      it("stays visible but never navigates or reports a selection", async () => {
        const user = userEvent.setup();
        const onLocationSelect = vi.fn();
        renderLocation(onLocationSelect);

        const card = screen.getByRole("link");
        expect(card).toBeVisible();
        expect(card).toHaveAttribute("aria-disabled", "true");
        expect(card).not.toHaveAttribute("href");
        await user.click(card);

        expect(onLocationSelect).not.toHaveBeenCalled();
      });
    }

    it("has no accessibility violations", async () => {
      const { container } = renderLocation();

      expect(await axe(container)).toHaveNoViolations();
    });

    it("has no accessibility violations as the next stop", async () => {
      const { container } = renderLocation(undefined, true);

      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
