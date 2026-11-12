import { useId } from "react";

import { PlaceholderArt } from "@/components/ui/PlaceholderArt";

import { CONTENT_LANG, type Word } from "../model/content";

type WordCardProps = {
  word: Word;
};

// One word of a place: its picture and the word, to look at, not to press
// (the games arrive in phase 2). A word's note says which meaning is meant
// ("morska zvijezda", a sea star, for "zvijezda"): it is heard after the word
// but not shown, so the card shows one word. The picture is decorative: the
// word carries the meaning.
export function WordCard({ word }: WordCardProps) {
  const captionId = useId();
  return (
    // Named by its caption, so the name has one source: the word, then the
    // note in a part only screen readers get, "zvijezda, morska zvijezda".
    <figure
      aria-labelledby={captionId}
      lang={CONTENT_LANG}
      className="flex flex-1 flex-col overflow-hidden rounded-tile border-2 border-surface-sunken bg-surface shadow-sm"
    >
      <div aria-hidden="true" className="aspect-tile w-full">
        {word.imageUrl !== null ? (
          // eslint-disable-next-line @next/next/no-img-element -- next/image needs every image host in next.config's remotePatterns, and there is no media host until phase 2 (ADR 0005: image_url is null)
          <img
            src={word.imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="block size-full object-cover"
          />
        ) : (
          // Keyed on the recording number, the word's id in every environment.
          <PlaceholderArt id={`word-${word.number}`} label={word.text} />
        )}
      </div>
      <figcaption
        id={captionId}
        className="break-words p-3 text-lg font-bold leading-snug text-ink"
      >
        {word.text}
        {word.note !== null ? (
          <span className="sr-only">, {word.note}</span>
        ) : null}
      </figcaption>
    </figure>
  );
}
