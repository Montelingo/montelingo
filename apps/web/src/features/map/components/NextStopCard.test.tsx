import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { type MapPlace, toMapData } from "../model/map-view";
import { newAccountProgress, seedRegionDetails } from "../test-fixtures";
import { NextStopCard } from "./NextStopCard";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

function seedBudva(): MapPlace {
  const place = toMapData(
    seedRegionDetails(),
    newAccountProgress(),
  ).places.find(({ id }) => id === "budva");
  if (place === undefined) {
    throw new Error("No Budva on the map");
  }
  return place;
}

afterEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/");
});

describe("NextStopCard", () => {
  it("opens the level card in place on the place's own region", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/play/coast");
    render(<NextStopCard place={seedBudva()} />);

    await user.click(screen.getByRole("link", { name: "Otvori: Budva" }));

    expect(`${window.location.pathname}${window.location.search}`).toBe(
      "/play/coast?place=budva",
    );
    expect(router.push).not.toHaveBeenCalled();
  });

  it("links to the card over the place's region from elsewhere", () => {
    window.history.replaceState(null, "", "/play");
    render(<NextStopCard place={seedBudva()} />);

    expect(screen.getByRole("link", { name: "Otvori: Budva" })).toHaveAttribute(
      "href",
      "/play/coast?place=budva",
    );
  });
});
