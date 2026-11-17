/* eslint-disable @next/next/no-html-link-for-pages --
   Plain links on purpose: the indicator listens for any link's click, and
   next/link would need the app router, which tests do not have. */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import {
  endNavigation,
  isNavigationPending,
  NAVIGATION_TIMEOUT_MS,
} from "@/lib/navigation-progress";

import {
  NAVIGATION_PROGRESS_DELAY_MS,
  NavigationProgress,
} from "./NavigationProgress";

const navigation = vi.hoisted(() => ({ pathname: "/play", search: "" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

function renderWithLinks() {
  return render(
    <>
      <NavigationProgress />
      <a href="/play/coast">Coast</a>
      <a href={`${window.location.pathname}#top`}>Top</a>
      <a href="/play/north" target="_blank">
        North
      </a>
      <svg>
        <a href="/play/central">
          <text>Central</text>
        </a>
      </svg>
    </>,
  );
}

function bar() {
  return screen.queryByTestId("navigation-progress");
}

describe("NavigationProgress", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    navigation.pathname = "/play";
    navigation.search = "";
    // jsdom cannot navigate: links' clicks do nothing but reach the listener.
    document.addEventListener("click", preventNavigation);
  });

  afterEach(() => {
    act(() => {
      endNavigation();
    });
    document.removeEventListener("click", preventNavigation);
    vi.useRealTimers();
  });

  it("shows after a short delay once a link to another page is clicked", () => {
    renderWithLinks();

    fireEvent.click(screen.getByText("Coast"));
    expect(bar()).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(NAVIGATION_PROGRESS_DELAY_MS);
    });
    expect(bar()).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Učitava se…");
  });

  it("starts on an SVG link too", () => {
    renderWithLinks();

    fireEvent.click(screen.getByText("Central"));

    expect(isNavigationPending()).toBe(true);
  });

  it("hides once the URL changes", () => {
    const { rerender } = renderWithLinks();
    fireEvent.click(screen.getByText("Coast"));
    act(() => {
      vi.advanceTimersByTime(NAVIGATION_PROGRESS_DELAY_MS);
    });

    navigation.pathname = "/play/coast";
    rerender(<NavigationProgress />);

    expect(bar()).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("never shows for a navigation faster than its delay", () => {
    const { rerender } = renderWithLinks();
    fireEvent.click(screen.getByText("Coast"));

    navigation.pathname = "/play/coast";
    rerender(<NavigationProgress />);
    act(() => {
      vi.advanceTimersByTime(NAVIGATION_PROGRESS_DELAY_MS);
    });

    expect(bar()).not.toBeInTheDocument();
  });

  it.each([
    ["a modifier key", { metaKey: true }],
    ["the middle button", { button: 1 }],
  ])("ignores a click with %s", (_, init) => {
    renderWithLinks();

    fireEvent.click(screen.getByText("Coast"), init);

    expect(isNavigationPending()).toBe(false);
  });

  it("ignores a link that opens elsewhere, or stays on the page", () => {
    renderWithLinks();

    fireEvent.click(screen.getByText("North"));
    fireEvent.click(screen.getByText("Top"));

    expect(isNavigationPending()).toBe(false);
  });

  it("clears itself if a navigation never completes", () => {
    renderWithLinks();
    fireEvent.click(screen.getByText("Coast"));

    act(() => {
      vi.advanceTimersByTime(NAVIGATION_TIMEOUT_MS);
    });

    expect(bar()).not.toBeInTheDocument();
  });

  it("has no accessibility violations while it shows", async () => {
    const { container } = renderWithLinks();
    fireEvent.click(screen.getByText("Coast"));
    act(() => {
      vi.advanceTimersByTime(NAVIGATION_PROGRESS_DELAY_MS);
    });

    vi.useRealTimers();
    expect(await axe(container)).toHaveNoViolations();
  });
});

function preventNavigation(event: MouseEvent) {
  event.preventDefault();
}
