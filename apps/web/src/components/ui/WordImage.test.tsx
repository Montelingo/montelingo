import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { WordImage, type WordImageProps } from "./WordImage";

const SIZES = "(orientation: landscape) 25vw, 33vw";

function renderImage(props: Partial<WordImageProps> = {}) {
  return render(
    <WordImage
      src="/media/words/0001.webp?v=aaaa1111"
      src512="/media/words/0001-512.webp?v=bbbb2222"
      sizes={SIZES}
      placeholderId="word-1"
      {...props}
    />,
  );
}

describe("WordImage", () => {
  it("offers both files and lets the browser pick by the screen's sizes", () => {
    const { container } = renderImage();

    const image = container.querySelector("img");
    expect(image).toHaveAttribute("src", "/media/words/0001.webp?v=aaaa1111");
    expect(image).toHaveAttribute(
      "srcset",
      "/media/words/0001-512.webp?v=bbbb2222 512w, /media/words/0001.webp?v=aaaa1111 1024w",
    );
    expect(image).toHaveAttribute("sizes", SIZES);
  });

  it("holds a square box, is decorative and cannot be dragged", () => {
    const { container } = renderImage();

    const image = container.querySelector("img");
    expect(image).toHaveAttribute("width", "1024");
    expect(image).toHaveAttribute("height", "1024");
    expect(image).toHaveAttribute("alt", "");
    expect(image).toHaveAttribute("decoding", "async");
    expect(image).toHaveAttribute("draggable", "false");
  });

  it("offers only the 1024 px file when there is no 512 px one", () => {
    const { container } = renderImage({ src512: null });

    const image = container.querySelector("img");
    expect(image).toHaveAttribute("src", "/media/words/0001.webp?v=aaaa1111");
    expect(image).not.toHaveAttribute("srcset");
  });

  it("passes the screen's loading hints on", () => {
    const lazy = renderImage({ loading: "lazy" }).container;
    const first = renderImage({ fetchPriority: "high" }).container;

    expect(lazy.querySelector("img")).toHaveAttribute("loading", "lazy");
    expect(first.querySelector("img")).toHaveAttribute("fetchpriority", "high");
    expect(first.querySelector("img")).not.toHaveAttribute("loading");
  });

  it("shows the placeholder art for a word with no picture", () => {
    const { container } = renderImage({ src: null, src512: null });

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("shows the placeholder art, not a broken image, when the file fails", () => {
    const { container } = renderImage();

    fireEvent.error(container.querySelector("img") as HTMLImageElement);

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("tries a new file after one failed", () => {
    const { container, rerender } = renderImage();
    fireEvent.error(container.querySelector("img") as HTMLImageElement);

    rerender(
      <WordImage
        src="/media/words/0002.webp"
        src512="/media/words/0002-512.webp"
        sizes={SIZES}
        placeholderId="word-2"
      />,
    );

    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "/media/words/0002.webp",
    );
  });

  it("draws the placeholder without a letter where none may show", () => {
    const { container } = renderImage({
      src: null,
      src512: null,
      placeholderLabel: "more",
      withInitial: false,
    });

    expect(container.querySelector("text")).toBeNull();
  });

  it("has no axe violations, with a picture or the placeholder", async () => {
    const picture = renderImage().container;
    const placeholder = renderImage({ src: null, src512: null }).container;

    expect(await axe(picture)).toHaveNoViolations();
    expect(await axe(placeholder)).toHaveNoViolations();
  });
});
