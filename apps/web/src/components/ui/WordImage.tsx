"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

import { PlaceholderArt } from "./PlaceholderArt";

/** A word's two picture files, as the API sends them. */
export type WordPicture = {
  /** The 1024 px file. */
  src: string;
  /** The 512 px file; `null` if the API sent none, and then only `src` is offered. */
  src512: string | null;
};

/** The `srcSet` that offers both files, so the browser picks one for the screen. */
export function wordImageSrcSet({
  src,
  src512,
}: WordPicture): string | undefined {
  return src512 === null ? undefined : `${src512} 512w, ${src} 1024w`;
}

export type WordImageProps = {
  /** The 1024 px picture, or `null` while the word has none: the placeholder. */
  src: string | null;
  /** The 512 px picture. */
  src512: string | null;
  /**
   * How wide the picture shows, as an `<img sizes>` value: the screen's own,
   * so a board's tile gets the 512 file and the lesson's card the 1024 one
   * (docs/architecture/word-images.md, section 4).
   */
  sizes: string;
  /** Picks the placeholder's colours and pattern: a stable id, such as `word-12`. */
  placeholderId: string;
  /** The placeholder's initial is taken from it. */
  placeholderLabel?: string;
  /** Draw an initial on the placeholder (the default), or none where no letter may show. */
  withInitial?: boolean;
  /** `lazy` for pictures further down a page, such as the place screen's word cards. */
  loading?: "lazy";
  /** `high` for the picture a screen opens with, such as the lesson's first card. */
  fetchPriority?: "high";
  /** Layout for the picture, and for the placeholder in its place. */
  className?: string;
  /** Layout for the placeholder only, added to `className`. */
  placeholderClassName?: string;
};

// A word's picture (#206): one place for how every screen shows it. Both files
// in `srcSet`, so a board's small tiles load the 512 px file; a fixed 1024 ×
// 1024 box, so nothing shifts while it loads; and `PlaceholderArt` when the
// word has no picture or its file fails, never a broken-image icon.
//
// Decorative: the word is named by a wrapper (an aria-label, a caption), so a
// screen reader does not hear it twice.
export function WordImage({
  src,
  src512,
  sizes,
  placeholderId,
  placeholderLabel,
  withInitial = true,
  loading,
  fetchPriority,
  className,
  placeholderClassName,
}: WordImageProps) {
  // The file that failed, so a new `src` gets its own try.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // A file that failed before the page hydrated fired its `error` before
  // React listened. Loaded and empty means it failed.
  useEffect(() => {
    const image = imageRef.current;
    if (image !== null && image.complete && image.naturalWidth === 0) {
      setFailedSrc(src);
    }
  }, [src]);

  if (src === null || failedSrc === src) {
    return (
      <PlaceholderArt
        id={placeholderId}
        label={placeholderLabel}
        withInitial={withInitial}
        className={cn(className, placeholderClassName)}
      />
    );
  }

  return (
    // Word images are same-origin WebP files at their final sizes
    // (public/media/words), so next/image would only add an optimiser.
    // eslint-disable-next-line @next/next/no-img-element -- see above
    <img
      ref={imageRef}
      src={src}
      srcSet={wordImageSrcSet({ src, src512 })}
      sizes={sizes}
      width={1024}
      height={1024}
      alt=""
      loading={loading}
      fetchPriority={fetchPriority}
      decoding="async"
      draggable={false}
      onError={() => setFailedSrc(src)}
      className={className}
    />
  );
}
