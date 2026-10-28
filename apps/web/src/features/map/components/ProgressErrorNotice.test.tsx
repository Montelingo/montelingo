import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { ProgressErrorNotice } from "./ProgressErrorNotice";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const NOTICE =
  "Your places didn’t load. Something went wrong on our side. Let’s try again.";
const STILL_NOT_LOADED = "Still not loaded. Try again in a moment.";

// The notice's own status region comes first, then the retry's.
function statuses() {
  const [notice, retry] = screen.getAllByRole("status");
  if (notice === undefined || retry === undefined) {
    throw new Error("Expected the notice's and the retry's status regions.");
  }
  return { notice, retry };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProgressErrorNotice", () => {
  it("explains calmly that the problem is on our side, and announces it", async () => {
    render(<ProgressErrorNotice />);

    await waitFor(() => {
      expect(statuses().notice).toHaveTextContent(NOTICE);
    });
    // Nothing that suggests the learner or their device is to blame.
    expect(statuses().notice).not.toHaveTextContent(
      /your connection|your device/i,
    );
  });

  it("says nothing about retrying before a retry", () => {
    render(<ProgressErrorNotice />);

    expect(statuses().retry).toBeEmptyDOMElement();
    expect(screen.queryByText(STILL_NOT_LOADED)).not.toBeInTheDocument();
  });

  it("reads the page again on retry", async () => {
    const user = userEvent.setup();
    render(<ProgressErrorNotice />);

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("retries from the keyboard", async () => {
    const user = userEvent.setup();
    render(<ProgressErrorNotice />);

    await user.tab();
    expect(screen.getByRole("button", { name: "Try again" })).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  // Still mounted once the refresh finished means progress still failed: a
  // screen whose progress loaded drops the notice.
  it("shows and announces that a finished retry did not help", async () => {
    const user = userEvent.setup();
    render(<ProgressErrorNotice />);

    await user.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => {
      expect(statuses().retry).toHaveTextContent(STILL_NOT_LOADED);
    });
    // Seen as well as heard: the visible line, and the announcement.
    expect(screen.getAllByText(STILL_NOT_LOADED)).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).not.toHaveAttribute("aria-disabled");
  });

  it("announces every failed retry anew, even with the same words", async () => {
    const user = userEvent.setup();
    render(<ProgressErrorNotice />);
    const button = screen.getByRole("button", { name: "Try again" });

    await user.click(button);
    await waitFor(() => {
      expect(statuses().retry).toHaveTextContent(STILL_NOT_LOADED);
    });
    const firstAnnouncement = statuses().retry.firstElementChild;

    await user.click(button);
    await waitFor(() => {
      expect(statuses().retry.firstElementChild).not.toBe(firstAnnouncement);
    });

    expect(router.refresh).toHaveBeenCalledTimes(2);
    expect(statuses().retry).toHaveTextContent(STILL_NOT_LOADED);
    expect(statuses().retry.children).toHaveLength(1);
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<ProgressErrorNotice />);

    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no accessibility violations after a failed retry", async () => {
    const user = userEvent.setup();
    const { container } = render(<ProgressErrorNotice />);
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => {
      expect(statuses().retry).toHaveTextContent(STILL_NOT_LOADED);
    });

    expect(await axe(container)).toHaveNoViolations();
  });
});
