import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { SAVE_NOTICE_COPY, SaveNotice } from "./SaveNotice";

function retryButton() {
  return screen.queryByRole("button", { name: SAVE_NOTICE_COPY.retry });
}

function getRetryButton() {
  return screen.getByRole("button", { name: SAVE_NOTICE_COPY.retry });
}

function announced() {
  act(() => {
    vi.advanceTimersByTime(100);
  });
}

describe("SaveNotice", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("says the result did not save, a moment after it appears, with a retry", () => {
    const onRetry = vi.fn();
    render(<SaveNotice status="failed" onRetry={onRetry} />);
    expect(screen.getByRole("status")).toHaveTextContent("");

    announced();
    fireEvent.click(getRetryButton());

    expect(screen.getByRole("status")).toHaveTextContent(
      SAVE_NOTICE_COPY.failed,
    );
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("keeps the retry focusable but ignores it while saving", () => {
    const onRetry = vi.fn();
    render(<SaveNotice status="saving" onRetry={onRetry} />);
    announced();

    fireEvent.click(getRetryButton());

    expect(retryButton()).toHaveAttribute("aria-disabled", "true");
    expect(onRetry).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent(
      SAVE_NOTICE_COPY.saving,
    );
  });

  it("says it saved and moves the focus from the retry, which is gone", () => {
    const { rerender } = render(
      <SaveNotice status="failed" onRetry={() => {}} />,
    );
    announced();
    getRetryButton().focus();
    fireEvent.click(getRetryButton());

    rerender(<SaveNotice status="saved" onRetry={() => {}} />);

    expect(retryButton()).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(
      SAVE_NOTICE_COPY.saved,
    );
    expect(screen.getByRole("status")).toHaveFocus();
  });

  it("has no accessibility violations", async () => {
    vi.useRealTimers();
    const { container } = render(
      <SaveNotice status="failed" onRetry={() => {}} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
