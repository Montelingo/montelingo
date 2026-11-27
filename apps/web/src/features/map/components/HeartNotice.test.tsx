import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { HeartNotice } from "./HeartNotice";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("HeartNotice", () => {
  it("shows the heart the replay earned, with the heart icon", () => {
    const { container } = render(<HeartNotice />);

    expect(screen.getByText("+1 srce")).toBeVisible();
    expect(
      container.querySelector('img[src*="icon-heart"]'),
    ).toBeInTheDocument();
  });

  it("announces it a moment after it appears, so screen readers hear it", () => {
    render(<HeartNotice />);
    expect(screen.getByRole("status")).toHaveTextContent("");

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByRole("status")).toHaveTextContent("+1 srce");
  });

  it("has no accessibility violations", async () => {
    vi.useRealTimers();
    const { container } = render(<HeartNotice />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
