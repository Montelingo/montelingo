import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { TileCard } from "./TileCard";
import { TILE_CARD_STATES, type TileCardState } from "./tile-card-state";

const OPEN_STATES = [
  ["available", "Open"],
  ["active", "Current"],
  ["in-progress", "In progress"],
  ["completed", "Done"],
] as const satisfies ReadonlyArray<readonly [TileCardState, string]>;

const CLOSED_STATES = [
  ["locked", "Locked"],
  ["loading", "Loading"],
  ["error", "Not loaded"],
] as const satisfies ReadonlyArray<readonly [TileCardState, string]>;

const ALL_STATES = [...OPEN_STATES, ...CLOSED_STATES];

type CardOptions = {
  state: TileCardState;
  isNext?: boolean;
  onActivate?: () => void;
  statusLabels?: Partial<Record<TileCardState, string>>;
  nextLabel?: string;
};

function renderCard({ state, ...props }: CardOptions) {
  return render(
    <TileCard
      title="Kotor"
      state={state}
      href="/play/kotor"
      picture={<svg aria-hidden="true" />}
      {...props}
    />,
  );
}

function card(name: string | RegExp = /^Kotor/) {
  return screen.getByRole("link", { name });
}

// The card's visible face, which carries the locked feedback while it plays.
function face(): Element {
  const element = card().firstElementChild;
  if (element === null) {
    throw new Error("The card has no face");
  }
  return element;
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
  vi.useRealTimers();
});

describe("TileCard", () => {
  it("covers every state", () => {
    expect(ALL_STATES.map(([state]) => state).sort()).toEqual(
      [...TILE_CARD_STATES].sort(),
    );
  });

  describe.each(ALL_STATES)("when %s", (state, label) => {
    it(`shows the title and a "${label}" badge, and is named by both`, () => {
      renderCard({ state });

      expect(screen.getByText("Kotor")).toBeVisible();
      expect(screen.getByText(label)).toBeVisible();
      expect(card()).toHaveAccessibleName(`Kotor, ${label}`);
    });

    it("has no accessibility violations", async () => {
      const { container } = renderCard({ state });

      expect(await axe(container)).toHaveNoViolations();
    });

    it("has no accessibility violations as the next place", async () => {
      const { container } = renderCard({ state, isNext: true });

      expect(await axe(container)).toHaveNoViolations();
    });
  });

  describe.each(OPEN_STATES)("when %s (open)", (state) => {
    it("links to its destination", () => {
      renderCard({ state });

      expect(card()).toHaveAttribute("href", "/play/kotor");
      expect(card()).not.toHaveAttribute("aria-disabled");
    });

    it("activates once on click", async () => {
      const user = userEvent.setup();
      const onActivate = vi.fn();
      renderCard({ state, onActivate });

      await user.click(card());

      expect(onActivate).toHaveBeenCalledTimes(1);
    });

    it("activates once on Enter", async () => {
      const user = userEvent.setup();
      const onActivate = vi.fn();
      renderCard({ state, onActivate });

      await user.tab();
      expect(card()).toHaveFocus();
      await user.keyboard("{Enter}");

      expect(onActivate).toHaveBeenCalledTimes(1);
    });

    it("activates once on Space", async () => {
      const user = userEvent.setup();
      const onActivate = vi.fn();
      renderCard({ state, onActivate });

      await user.tab();
      await user.keyboard(" ");

      expect(onActivate).toHaveBeenCalledTimes(1);
    });

    it("does not activate again while Space is held down", () => {
      const onActivate = vi.fn();
      renderCard({ state, onActivate });

      fireEvent.keyDown(card(), { key: " " });
      fireEvent.keyDown(card(), { key: " ", repeat: true });
      fireEvent.keyDown(card(), { key: " ", repeat: true });

      expect(onActivate).toHaveBeenCalledTimes(1);
    });

    it("does not stop Space from reaching the page when it is not the card's", () => {
      renderCard({ state });

      expect(fireEvent.keyDown(card(), { key: "a" })).toBe(true);
      expect(fireEvent.keyDown(card(), { key: " " })).toBe(false);
    });
  });

  describe.each(CLOSED_STATES)("when %s (closed)", (state) => {
    it("stays visible and focusable, marked disabled, with no destination", async () => {
      const user = userEvent.setup();
      renderCard({ state });

      await user.tab();

      expect(card()).toBeVisible();
      expect(card()).toHaveFocus();
      expect(card()).toHaveAttribute("aria-disabled", "true");
      expect(card()).not.toHaveAttribute("href");
    });

    it("never activates, by click, Enter, or Space", async () => {
      const user = userEvent.setup();
      const onActivate = vi.fn();
      renderCard({ state, onActivate });

      await user.click(card());
      await user.tab();
      await user.keyboard("{Enter}");
      await user.keyboard(" ");

      expect(onActivate).not.toHaveBeenCalled();
    });
  });

  describe("when locked", () => {
    it("answers a tap with a wiggle and a spoken message", async () => {
      const user = userEvent.setup();
      renderCard({ state: "locked" });

      expect(screen.getByRole("status")).toBeEmptyDOMElement();
      await user.click(card());

      expect(screen.getByRole("status")).toHaveTextContent(
        "Kotor is locked for now.",
      );
      expect(face()).toHaveAttribute("data-feedback", "wiggle");
    });

    it("answers Enter and Space the same way, keeping focus", async () => {
      const user = userEvent.setup();
      renderCard({ state: "locked" });

      await user.tab();
      await user.keyboard("{Enter}");
      expect(screen.getByRole("status")).toHaveTextContent(
        "Kotor is locked for now.",
      );

      fireEvent.animationEnd(face());
      await user.keyboard(" ");

      expect(face()).toHaveAttribute("data-feedback", "wiggle");
      expect(card()).toHaveFocus();
    });

    it("announces every tap, even with the same message", async () => {
      const user = userEvent.setup();
      renderCard({ state: "locked" });

      await user.click(card());
      const firstMessage = screen.getByText("Kotor is locked for now.");
      await user.click(card());
      const secondMessage = screen.getByText("Kotor is locked for now.");

      // A new node in the live region is what makes it speak again.
      expect(secondMessage).not.toBe(firstMessage);
      expect(firstMessage).not.toBeInTheDocument();
    });

    it("keeps the message out of the card's name", async () => {
      const user = userEvent.setup();
      renderCard({ state: "locked" });

      await user.click(card());

      expect(card()).toHaveAccessibleName("Kotor, Locked");
    });

    it("stops wiggling when the animation ends", async () => {
      const user = userEvent.setup();
      renderCard({ state: "locked" });

      await user.click(card());
      fireEvent.animationEnd(face());

      expect(face()).not.toHaveAttribute("data-feedback");
    });

    it("stops wiggling even when the animation never ends", () => {
      vi.useFakeTimers();
      renderCard({ state: "locked" });

      fireEvent.click(card());
      expect(face()).toHaveAttribute("data-feedback", "wiggle");
      act(() => {
        vi.advanceTimersByTime(600);
      });

      expect(face()).not.toHaveAttribute("data-feedback");
    });

    it("ignores animations that end inside the card", async () => {
      const user = userEvent.setup();
      render(
        <TileCard
          title="Kotor"
          state="locked"
          href="/play/kotor"
          picture={<span data-testid="picture" />}
        />,
      );

      await user.click(card());
      fireEvent.animationEnd(screen.getByTestId("picture"));

      expect(face()).toHaveAttribute("data-feedback", "wiggle");
    });

    it("has no accessibility violations after a tap", async () => {
      const user = userEvent.setup();
      const { container } = renderCard({ state: "locked" });

      await user.click(card());

      expect(await axe(container)).toHaveNoViolations();
    });
  });

  describe.each(["loading", "error"] as const)("when %s", (state) => {
    it("does not answer a tap like a locked card", async () => {
      const user = userEvent.setup();
      renderCard({ state });

      await user.click(card());
      await user.tab();
      await user.keyboard("{Enter}");

      expect(screen.getByRole("status")).toBeEmptyDOMElement();
      expect(face()).not.toHaveAttribute("data-feedback");
    });
  });

  describe("as the next place to go", () => {
    it("shows a labelled mark, part of its name", () => {
      renderCard({ state: "available", isNext: true });

      expect(screen.getByText("Next")).toBeVisible();
      expect(card()).toHaveAccessibleName("Kotor, Open, Next");
    });

    it("is not marked otherwise", () => {
      renderCard({ state: "available" });

      expect(screen.queryByText("Next")).not.toBeInTheDocument();
    });

    it("takes its own mark text", () => {
      renderCard({
        state: "available",
        isNext: true,
        nextLabel: "Go here next",
      });

      expect(screen.getByText("Go here next")).toBeVisible();
      expect(card()).toHaveAccessibleName("Kotor, Open, Go here next");
    });
  });

  it("takes its own badge text per state", () => {
    renderCard({
      state: "completed",
      statusLabels: { completed: "Explored", locked: "Not yet" },
    });

    expect(screen.getByText("Explored")).toBeVisible();
    expect(card()).toHaveAccessibleName("Kotor, Explored");
  });

  it("hides the picture from assistive technology", () => {
    render(
      <TileCard
        title="Kotor"
        state="available"
        href="/play/kotor"
        picture={<svg role="img" aria-label="The bay of Kotor" />}
      />,
    );

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(card()).toHaveAccessibleName("Kotor, Open");
  });
});
