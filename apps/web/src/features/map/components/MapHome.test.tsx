import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { MAP_NOTICES, type MapNotice, withMapNotice } from "../model/notices";
import { toRegionPickerRegions } from "../model/screens";
import { newAccountProgress, seedRegions } from "../test-fixtures";
import { MapHome } from "./MapHome";

// useSearchParams() returns the URL as it is now, like Next.js, whose router
// follows history.replaceState().
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

const newAccountRegions = toRegionPickerRegions(
  seedRegions(),
  newAccountProgress(),
);
const failedRegions = toRegionPickerRegions(seedRegions(), {
  status: "error",
});
// Progress answered, but without an entry for the north.
const uncoveredRegions = toRegionPickerRegions(seedRegions(), {
  status: "ready",
  progress: {
    regions: [
      { id: "coast", state: "available" },
      { id: "central", state: "locked" },
    ],
    locations: [],
  },
});

function renderHome(
  regions = newAccountRegions,
  notice: MapNotice | null = null,
) {
  // The page shows a notice it read from its URL.
  const path = "/play";
  window.history.replaceState(
    null,
    "",
    notice === null ? path : withMapNotice(path, notice),
  );
  return render(<MapHome regions={regions} notice={notice} />);
}

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

describe("MapHome", () => {
  it("is headed as the learner's map", () => {
    renderHome();

    expect(
      screen.getByRole("heading", { level: 1, name: "Your map" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Your map" }),
    ).toBeInTheDocument();
  });

  it("shows every region to pick from", () => {
    renderHome();

    expect(
      within(screen.getByRole("list", { name: "Regions" })).getAllByRole(
        "listitem",
      ),
    ).toHaveLength(3);
  });

  it("shows no notice and no retry when there is nothing to say", () => {
    renderHome();

    expect(
      screen.queryByText(MAP_NOTICES["region-locked"]),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
  });

  it("says why the learner was sent back from a locked region", () => {
    renderHome(newAccountRegions, "region-locked");

    expect(screen.getByText(MAP_NOTICES["region-locked"])).toBeVisible();
  });

  it("offers a retry when progress could not be read, still showing the regions", () => {
    renderHome(failedRegions);

    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Obala, Not loaded" }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("offers the same retry when progress has no state for a region", () => {
    renderHome(uncoveredRegions);

    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Sjever i planine, Loading" }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("has no accessibility violations for a new account", async () => {
    const { container } = renderHome();

    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no accessibility violations with a notice", async () => {
    const { container } = renderHome(newAccountRegions, "region-locked");

    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no accessibility violations when progress failed", async () => {
    const { container } = renderHome(failedRegions);

    expect(await axe(container)).toHaveNoViolations();
  });
});
