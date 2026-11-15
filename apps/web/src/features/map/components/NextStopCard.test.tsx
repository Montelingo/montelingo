import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { type MapPlace, toMapData } from "../model/map-view";
import {
  currentPath,
  newAccountProgress,
  seedRegionDetails,
} from "../test-fixtures";
import { NextStopCard } from "./NextStopCard";

const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

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

    expect(currentPath()).toBe("/play/coast?place=budva");
    expect(router.push).not.toHaveBeenCalled();
  });

  it("goes to the place's region from elsewhere", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/play");
    render(<NextStopCard place={seedBudva()} />);

    await user.click(screen.getByRole("link", { name: "Otvori: Budva" }));

    expect(router.push).toHaveBeenCalledWith("/play/coast?place=budva");
  });

  it("leaves a click with a modifier key to the browser", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/play/coast");
    render(<NextStopCard place={seedBudva()} />);
    const link = screen.getByRole("link", { name: "Otvori: Budva" });
    // jsdom cannot open a new tab, so the click stops at the document, after
    // the link's own handler has let it through.
    const stop = (event: Event) => event.preventDefault();
    document.addEventListener("click", stop);

    await user.keyboard("{Control>}");
    await user.click(link);
    await user.keyboard("{/Control}");
    document.removeEventListener("click", stop);

    expect(currentPath()).toBe("/play/coast");
    expect(router.push).not.toHaveBeenCalled();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<NextStopCard place={seedBudva()} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
