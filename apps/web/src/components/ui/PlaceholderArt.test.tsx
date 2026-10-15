import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { PlaceholderArt } from "./PlaceholderArt";

function renderArt(id: string, label?: string) {
  const { container } = render(<PlaceholderArt id={id} label={label} />);
  const svg = container.querySelector("svg");
  if (svg === null) {
    throw new Error("PlaceholderArt rendered no <svg>");
  }
  return { container, svg };
}

describe("PlaceholderArt", () => {
  it("draws the same picture for the same ID", () => {
    const first = renderArt("kotor", "Kotor").svg.outerHTML;
    const second = renderArt("kotor", "Kotor").svg.outerHTML;

    expect(second).toBe(first);
  });

  it("draws different pictures for different IDs", () => {
    const pictures = new Set(
      ["kotor", "budva", "bar", "ulcinj", "tivat"].map(
        (id) => renderArt(id).svg.outerHTML,
      ),
    );

    expect(pictures.size).toBeGreaterThan(1);
  });

  it("shows the label's initial", () => {
    const { svg } = renderArt("town-1", "Žabljak");

    expect(svg).toHaveTextContent(/^Ž$/);
  });

  it("shows a Montenegrin digraph as one initial", () => {
    const { svg } = renderArt("town-2", "Njeguši");

    expect(svg).toHaveTextContent(/^Nj$/);
  });

  it("is decorative, hidden from assistive technology and the tab order", () => {
    const { svg } = renderArt("kotor", "Kotor");

    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("focusable", "false");
  });

  it("uses no IDs, so several pictures on one page cannot clash", () => {
    const { container } = render(
      <>
        <PlaceholderArt id="kotor" />
        <PlaceholderArt id="budva" />
      </>,
    );

    expect(container.querySelector("[id]")).toBeNull();
  });

  it("has no accessibility violations", async () => {
    const { container } = renderArt("kotor", "Kotor");

    expect(await axe(container)).toHaveNoViolations();
  });
});
