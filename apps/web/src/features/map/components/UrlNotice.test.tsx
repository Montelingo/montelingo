import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { MAP_NOTICES } from "../model/notices";
import { UrlNotice } from "./UrlNotice";

// Like Next.js, whose router follows history.replaceState(), useSearchParams()
// returns the URL as it is now.
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

const message = MAP_NOTICES["region-locked"];

function visit(path: string) {
  window.history.replaceState(null, "", path);
}

function currentPath() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

async function waitForAnnouncement() {
  await waitFor(() => {
    expect(screen.getByRole("status")).toHaveTextContent(message);
  });
}

afterEach(() => {
  visit("/");
});

describe("UrlNotice", () => {
  it("shows the notice from the URL and announces it", async () => {
    visit("/play?notice=region-locked");

    render(<UrlNotice notice="region-locked" />);

    expect(screen.getByText(message)).toBeVisible();
    await waitForAnnouncement();
  });

  it("keeps ?notice= in the URL until the notice has been announced", () => {
    visit("/play?notice=region-locked");

    render(<UrlNotice notice="region-locked" />);

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(currentPath()).toBe("/play?notice=region-locked");
  });

  it("then drops ?notice= from the URL, so a reload does not show it again, and keeps showing it", async () => {
    visit("/play?notice=region-locked");
    const { rerender } = render(<UrlNotice notice="region-locked" />);

    await waitForAnnouncement();

    expect(currentPath()).toBe("/play");
    // The router renders again with the new URL: the notice stays.
    rerender(<UrlNotice notice="region-locked" />);
    expect(screen.getByText(message, { selector: "p" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(message);
  });

  it("keeps the other parameters, in their order and encoding, and the hash", async () => {
    visit("/play/coast?from=map&notice=location-locked&q=a%20b#places");

    render(<UrlNotice notice="location-locked" />);

    await waitFor(() => {
      expect(currentPath()).toBe("/play/coast?from=map&q=a%20b#places");
    });
    expect(
      screen.getByText(MAP_NOTICES["location-locked"], { selector: "p" }),
    ).toBeVisible();
  });

  it("replaces the URL once, as Next.js documents, without a navigation", async () => {
    visit("/play?notice=region-locked");
    const replaceState = vi.spyOn(window.history, "replaceState");

    render(<UrlNotice notice="region-locked" />);

    await waitForAnnouncement();
    // Next.js's patched replaceState() copies the router's own state over.
    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(replaceState).toHaveBeenCalledWith(null, "", "/play");
    replaceState.mockRestore();
  });

  // Back returns to the screen from the router's cache, which still holds the
  // notice, at the URL the notice already cleaned up.
  it("shows nothing when the URL no longer has the notice", () => {
    visit("/play");

    const { container } = render(<UrlNotice notice="region-locked" />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows nothing when the URL has another notice", () => {
    visit("/play?notice=location-locked");

    const { container } = render(<UrlNotice notice="region-locked" />);

    expect(container).toBeEmptyDOMElement();
  });

  it("has no accessibility violations, before and after the announcement", async () => {
    visit("/play?notice=region-locked");
    const { container } = render(<UrlNotice notice="region-locked" />);

    expect(await axe(container)).toHaveNoViolations();
    await waitForAnnouncement();
    expect(await axe(container)).toHaveNoViolations();
  });
});
