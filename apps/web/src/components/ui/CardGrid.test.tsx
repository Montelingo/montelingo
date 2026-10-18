import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { CardGrid } from "./CardGrid";

function cards(count: number) {
  return Array.from({ length: count }, (_, index) => (
    <a key={`place-${index}`} href={`/places/${index}`}>
      Place {index + 1}
    </a>
  ));
}

describe("CardGrid", () => {
  it.each([3, 10])("lists %i cards, one per item", (count) => {
    render(<CardGrid label="Places">{cards(count)}</CardGrid>);

    const list = screen.getByRole("list", { name: "Places" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(count);
    items.forEach((item, index) => {
      expect(
        within(item).getByRole("link", { name: `Place ${index + 1}` }),
      ).toBeInTheDocument();
    });
  });

  it("skips empty children instead of leaving empty items", () => {
    render(
      <CardGrid label="Places">
        <a href="/places/1">Place 1</a>
        {null}
        {false}
        <a href="/places/2">Place 2</a>
      </CardGrid>,
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <CardGrid label="Places">{cards(10)}</CardGrid>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
