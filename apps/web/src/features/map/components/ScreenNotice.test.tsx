import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { advanceTimers, tap } from "../test-fixtures";
import { ScreenNotice } from "./ScreenNotice";
import { MESSAGE_HIDE_DELAY_MS } from "./use-hide-message";

const message = "That region isn’t open yet.";

describe("ScreenNotice", () => {
  it("shows the message", () => {
    render(<ScreenNotice message={message} />);

    expect(screen.getByText(message)).toBeVisible();
  });

  it("announces the message politely, a moment after its live region appears", async () => {
    render(<ScreenNotice message={message} />);

    // Empty at first, so screen readers are already watching it when the
    // message arrives.
    const status = screen.getByRole("status");
    expect(status).toBeEmptyDOMElement();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(status).toHaveTextContent(message);
    });
  });

  it("is heard once: the visible copy is hidden from assistive technology", async () => {
    render(<ScreenNotice message={message} />);

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(message);
    });
    expect(screen.getAllByText(message)).toHaveLength(2);
    expect(
      screen
        .getAllByText(message)
        .filter((element) => element.closest("[aria-hidden='true']") === null),
    ).toEqual([screen.getByRole("status")]);
  });

  it("calls onAnnounce once, when the message is announced", async () => {
    const onAnnounce = vi.fn();
    const { rerender } = render(
      <ScreenNotice message={message} onAnnounce={onAnnounce} />,
    );

    expect(onAnnounce).not.toHaveBeenCalled();
    // A new callback on a later render neither restarts the delay nor runs
    // it again.
    const nextOnAnnounce = vi.fn();
    rerender(<ScreenNotice message={message} onAnnounce={nextOnAnnounce} />);
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(message);
    });
    expect(onAnnounce).not.toHaveBeenCalled();
    expect(nextOnAnnounce).toHaveBeenCalledTimes(1);
    rerender(<ScreenNotice message={message} onAnnounce={nextOnAnnounce} />);
    expect(nextOnAnnounce).toHaveBeenCalledTimes(1);
  });

  it("shows an action under the message", () => {
    render(
      <ScreenNotice message={message}>
        <button type="button">Try again</button>
      </ScreenNotice>,
    );

    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });

  it("has no accessibility violations, before and after the announcement", async () => {
    const { container } = render(<ScreenNotice message={message} />);

    expect(await axe(container)).toHaveNoViolations();
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(message);
    });
    expect(await axe(container)).toHaveNoViolations();
  });

  describe("hiding", () => {
    // The announcement comes a moment after mount.
    function announce() {
      advanceTimers(100);
      expect(screen.getByRole("status")).toHaveTextContent(message);
    }

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("hides itself a few seconds after it was announced", () => {
      const { container } = render(<ScreenNotice message={message} />);
      announce();

      advanceTimers(MESSAGE_HIDE_DELAY_MS - 1);
      expect(screen.getByText(message, { selector: "p" })).toBeVisible();
      advanceTimers(1);

      expect(container).toBeEmptyDOMElement();
    });

    it("hides at a tap anywhere, and that tap does nothing else", () => {
      const onOutsideClick = vi.fn();
      render(
        <>
          <ScreenNotice message={message} />
          <button type="button" onClick={onOutsideClick}>
            Elsewhere
          </button>
        </>,
      );
      announce();

      tap(screen.getByRole("button", { name: "Elsewhere" }));

      expect(screen.queryByText(message)).not.toBeInTheDocument();
      expect(onOutsideClick).not.toHaveBeenCalled();
    });

    it("keeps the tap that hides it from the document's own listeners", () => {
      const onDocumentClick = vi.fn();
      document.addEventListener("click", onDocumentClick, { capture: true });
      try {
        render(
          <>
            <ScreenNotice message={message} />
            <button type="button">Elsewhere</button>
          </>,
        );
        announce();

        tap(screen.getByRole("button", { name: "Elsewhere" }));

        expect(onDocumentClick).not.toHaveBeenCalled();
      } finally {
        document.removeEventListener("click", onDocumentClick, {
          capture: true,
        });
      }
    });

    it("lets a tap in an open dialog through, and stays", () => {
      const onDialogClick = vi.fn();
      render(
        <>
          <ScreenNotice message={message} />
          <dialog open>
            <button type="button" onClick={onDialogClick}>
              Zatvori
            </button>
          </dialog>
        </>,
      );
      announce();

      tap(screen.getByRole("button", { name: "Zatvori" }));

      expect(onDialogClick).toHaveBeenCalledTimes(1);
      expect(screen.getByText(message, { selector: "p" })).toBeVisible();
    });

    it("hides at a tap on its own words", () => {
      render(<ScreenNotice message={message} />);
      announce();

      tap(screen.getByText(message, { selector: "p" }));

      expect(screen.queryByText(message)).not.toBeInTheDocument();
    });

    it("can stay for its action, which works, until the learner taps away", () => {
      const onAction = vi.fn();
      render(
        <>
          <ScreenNotice message={message} staysUntilTappedAway>
            <button type="button" onClick={onAction}>
              Try again
            </button>
          </ScreenNotice>
          <button type="button">Elsewhere</button>
        </>,
      );
      announce();

      advanceTimers(MESSAGE_HIDE_DELAY_MS * 10);
      tap(screen.getByRole("button", { name: "Try again" }));

      expect(onAction).toHaveBeenCalledTimes(1);
      expect(screen.getByText(message, { selector: "p" })).toBeVisible();

      tap(screen.getByRole("button", { name: "Elsewhere" }));
      expect(screen.queryByText(message)).not.toBeInTheDocument();
    });
  });
});
