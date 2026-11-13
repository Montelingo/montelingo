import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { CardGrid, CardGridSkeleton } from "./CardGrid";

function cards(count: number) {
  return Array.from({ length: count }, (_, index) => (
    <a key={`place-${index}`} href={`/places/${index}`}>
      Place {index + 1}
    </a>
  ));
}

// A grid of words named by the heading above it.
const wordsUnderHeading = (
  <>
    <h2 id="beach-words">At the beach</h2>
    <CardGrid labelledBy="beach-words" columns="words">
      {cards(10)}
    </CardGrid>
  </>
);

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

  it("can be named by a heading on screen instead, so the name is not repeated", () => {
    render(wordsUnderHeading);

    const list = screen.getByRole("list", { name: "At the beach" });
    expect(list).not.toHaveAttribute("aria-label");
    expect(within(list).getAllByRole("listitem")).toHaveLength(10);
  });

  it.each([
    ["labelled", <CardGrid label="Places">{cards(10)}</CardGrid>],
    ["named by a heading, in word columns", wordsUnderHeading],
  ])("has no accessibility violations when %s", async (_case, grid) => {
    const { container } = render(grid);

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("CardGridSkeleton", () => {
  it.each(["tiles", "words"] as const)(
    "lays its blocks out like a CardGrid in %s columns, one per item",
    (columns) => {
      render(
        <>
          <CardGrid label="Places" columns={columns}>
            {cards(3)}
          </CardGrid>
          <CardGridSkeleton columns={columns} count={3}>
            <div className="block" />
          </CardGridSkeleton>
        </>,
      );

      const list = screen.getByRole("list", { name: "Places" });
      const [item] = within(list).getAllByRole("listitem");
      const skeleton = list.nextElementSibling;
      expect(skeleton?.className).toBe(list.className);
      expect(
        Array.from(skeleton?.children ?? [], (block) => [
          block.className,
          block.innerHTML,
        ]),
      ).toEqual(
        Array.from({ length: 3 }, () => [
          item?.className,
          '<div class="block"></div>',
        ]),
      );
    },
  );

  it("is hidden from screen readers, so it is not a list", async () => {
    const { container } = render(
      <CardGridSkeleton count={3}>
        <div />
      </CardGridSkeleton>,
    );

    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});
