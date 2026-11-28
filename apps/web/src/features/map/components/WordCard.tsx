import { useId } from "react";

import { WordImage } from "@/components/ui/WordImage";
import { cn } from "@/lib/cn";
import { fredoka } from "@/lib/fonts";

import { CONTENT_LANG, type Word } from "../model/content";

/**
 * How wide a card's picture shows: a grid column of at least 10rem (a phone's
 * Riječi tab fits three narrower ones), so even a 3× screen takes the 512 px
 * file.
 */
const PICTURE_SIZES = "10rem";

type WordCardProps = {
  word: Word;
  /**
   * `compact` for the Riječi tab's grid, where a phone fits three cards in a
   * row; `regular`, the default, for a place's screen.
   */
  size?: "regular" | "compact";
};

// One word of a place: its picture and the word, to look at, not to press
// (the games arrive in phase 2). A word's note says which meaning is meant
// ("igračka koja leti", a flying toy, for "zmaj", a kite): it is heard after
// the word but not shown, so the card shows one word. The picture is
// decorative: the word carries the meaning.
export function WordCard({ word, size = "regular" }: WordCardProps) {
  const isCompact = size === "compact";
  const captionId = useId();
  return (
    // Named by its caption, so the name has one source: the word, then the
    // note in a part only screen readers get, "zmaj, igračka koja leti".
    // The Figma word card: a white card with a grey raised edge, the picture
    // inset with its own corners, and the word below. The sound button comes
    // with audio, and the "learned" check with the lesson's state (#141).
    <figure
      aria-labelledby={captionId}
      lang={CONTENT_LANG}
      className={cn(
        "flex flex-1 flex-col overflow-hidden border-3 border-kid-line bg-white shadow-raised-line-4",
        isCompact ? "rounded-kid" : "rounded-kid-lg",
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "aspect-tile overflow-hidden",
          // mb-0 after the margin, or tailwind-merge drops it.
          isCompact ? "m-1.5 mb-0 rounded-kid-sm" : "m-2 mb-0 rounded-kid",
        )}
      >
        {/* Square pictures in a 4:3 tile: contain, so none is cropped. The
            placeholder is keyed on the recording number, the word's id in
            every environment. */}
        <WordImage
          src={word.imageUrl}
          src512={word.imageUrl512}
          sizes={PICTURE_SIZES}
          loading="lazy"
          placeholderId={`word-${word.number}`}
          placeholderLabel={word.text}
          className="block size-full object-contain"
        />
      </div>
      <figcaption
        id={captionId}
        className={cn(
          fredoka.className,
          "break-words text-center font-semibold leading-snug text-kid-ink",
          isCompact ? "px-1.5 pb-2 pt-1 text-base" : "px-3 pb-3 pt-2 text-xl",
        )}
      >
        {word.text}
        {word.note !== null ? (
          <span className="sr-only">, {word.note}</span>
        ) : null}
      </figcaption>
    </figure>
  );
}
