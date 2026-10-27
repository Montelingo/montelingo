import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { MAP_ELEMENT_STATES, type MapElementState } from "../model/map-state";
import { toRegionPickerRegions } from "../model/screens";
import {
  makeRegionPickerRegion,
  newAccountProgress,
  seedRegions,
} from "../test-fixtures";
import { RegionPicker } from "./RegionPicker";

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

function newAccountRegions() {
  return toRegionPickerRegions(seedRegions(), newAccountProgress());
}

function regionList() {
  return screen.getByRole("list", { name: "Regions" });
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

describe("RegionPicker", () => {
  it("covers every map state", () => {
    expect(STATES.map(([state]) => state).sort()).toEqual(
      [...MAP_ELEMENT_STATES].sort(),
    );
  });

  describe("for a new account", () => {
    it("shows the three regions in content order, the locked ones too", () => {
      render(<RegionPicker regions={newAccountRegions()} />);

      const cards = within(regionList()).getAllByRole("link");
      expect(cards.map((card) => card.getAttribute("aria-label"))).toEqual([
        "Obala, Open",
        "Centralna Crna Gora, Locked",
        "Sjever i planine, Locked",
      ]);
      cards.forEach((card) => {
        expect(card).toBeVisible();
      });
    });

    it("links the open region to its screen", () => {
      render(<RegionPicker regions={newAccountRegions()} />);

      expect(screen.getByRole("link", { name: "Obala, Open" })).toHaveAttribute(
        "href",
        "/play/coast",
      );
    });

    it("keeps the locked regions from navigating", () => {
      render(<RegionPicker regions={newAccountRegions()} />);

      const locked = screen.getByRole("link", {
        name: "Centralna Crna Gora, Locked",
      });
      expect(locked).toHaveAttribute("aria-disabled", "true");
      expect(locked).not.toHaveAttribute("href");
    });

    it("says calmly that a tapped locked region isn’t open yet", async () => {
      const user = userEvent.setup();
      render(<RegionPicker regions={newAccountRegions()} />);

      await user.click(
        screen.getByRole("link", { name: "Sjever i planine, Locked" }),
      );

      expect(
        screen.getByText("Sjever i planine isn’t open yet."),
      ).toBeInTheDocument();
    });

    it("has no accessibility violations", async () => {
      const { container } = render(
        <RegionPicker regions={newAccountRegions()} />,
      );

      expect(await axe(container)).toHaveNoViolations();
    });
  });

  describe.each(STATES)("with a %s region", (state, label, isOpen) => {
    function renderRegion(onRegionSelect?: (regionId: string) => void) {
      return render(
        <RegionPicker
          regions={[makeRegionPickerRegion({ state })]}
          onRegionSelect={onRegionSelect}
        />,
      );
    }

    it(`shows its name and a "${label}" badge`, () => {
      renderRegion();

      expect(screen.getByText("Obala")).toBeVisible();
      expect(screen.getByText(label)).toBeVisible();
      expect(screen.getByRole("link")).toHaveAccessibleName(`Obala, ${label}`);
    });

    if (isOpen) {
      it("is a real link to the region, and reports the selection", async () => {
        const user = userEvent.setup();
        const onRegionSelect = vi.fn();
        renderRegion(onRegionSelect);

        const card = screen.getByRole("link");
        expect(card).toHaveAttribute("href", "/play/coast");
        await user.click(card);

        expect(onRegionSelect).toHaveBeenCalledTimes(1);
        expect(onRegionSelect).toHaveBeenCalledWith("coast");
      });
    } else {
      it("stays visible but never navigates or reports a selection", async () => {
        const user = userEvent.setup();
        const onRegionSelect = vi.fn();
        renderRegion(onRegionSelect);

        const card = screen.getByRole("link");
        expect(card).toBeVisible();
        expect(card).toHaveAttribute("aria-disabled", "true");
        expect(card).not.toHaveAttribute("href");
        await user.click(card);

        expect(onRegionSelect).not.toHaveBeenCalled();
      });
    }

    it("has no accessibility violations", async () => {
      const { container } = renderRegion();

      expect(await axe(container)).toHaveNoViolations();
    });
  });

  it("still navigates with no selection callback", async () => {
    const user = userEvent.setup();
    render(<RegionPicker regions={[makeRegionPickerRegion()]} />);

    await user.click(screen.getByRole("link", { name: "Obala, Open" }));

    expect(screen.getByRole("link", { name: "Obala, Open" })).toHaveAttribute(
      "href",
      "/play/coast",
    );
  });
});
