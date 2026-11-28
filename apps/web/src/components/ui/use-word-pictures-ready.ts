"use client";

import { useEffect, useState } from "react";

import { type WordPicture, wordImageSrcSet } from "./WordImage";

/**
 * The longest a game waits for its pictures before it starts anyway: on a
 * stalled connection the child gets the game, with whatever has arrived,
 * rather than a skeleton for good.
 */
export const PICTURES_READY_TIMEOUT_MS = 8000;

/**
 * Whether the browser can decode a picture ahead of time. Every browser the
 * app supports can; jsdom cannot, so the component tests get their games at
 * once unless a test stubs `decode`.
 */
function canDecode(): boolean {
  return (
    typeof HTMLImageElement !== "undefined" &&
    typeof HTMLImageElement.prototype.decode === "function"
  );
}

/**
 * Load and decode one picture, choosing its file as the `<img>` will with the
 * same `srcSet` and `sizes`, so the board's own `<img>` finds it in the cache.
 * Never rejects: a file that fails shows the placeholder on its card.
 */
function decodePicture(picture: WordPicture, sizes: string): Promise<void> {
  const image = new Image();
  const srcSet = wordImageSrcSet(picture);
  if (srcSet !== undefined) {
    image.sizes = sizes;
    image.srcset = srcSet;
  }
  image.src = picture.src;
  return image.decode().catch(() => undefined);
}

/**
 * Whether every one of `pictures` is loaded and decoded (#206), so a card
 * never turns to an empty face and a round never opens on a blank. A failed
 * file counts as ready, and so does everything after
 * `PICTURES_READY_TIMEOUT_MS`. Pass the `sizes` the pictures show at.
 *
 * Without `img.decode()` (jsdom) it is true from the start.
 */
export function useWordPicturesReady(
  pictures: readonly WordPicture[],
  sizes: string,
): boolean {
  // The pictures by value, each file once: a caller's new array of the same
  // files is no new wait, and a memory pair's two cards are one picture.
  const key = JSON.stringify([
    ...new Map(pictures.map((picture) => [picture.src, picture])).values(),
  ]);
  const [readyKey, setReadyKey] = useState<string | null>(null);

  useEffect(() => {
    if (!canDecode()) {
      return;
    }
    let isSettled = false;
    const settle = () => {
      if (!isSettled) {
        isSettled = true;
        setReadyKey(key);
      }
    };
    const list = JSON.parse(key) as WordPicture[];
    void Promise.all(list.map((picture) => decodePicture(picture, sizes))).then(
      settle,
    );
    const timer = setTimeout(settle, PICTURES_READY_TIMEOUT_MS);
    return () => {
      isSettled = true;
      clearTimeout(timer);
    };
  }, [key, sizes]);

  return !canDecode() || readyKey === key;
}
