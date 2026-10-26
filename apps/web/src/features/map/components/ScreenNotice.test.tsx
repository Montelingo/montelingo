import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { ScreenNotice } from "./ScreenNotice";

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
});
