# Word images: quality and performance

This page describes how word images are made, stored, served and shown, so that 300 pictures stay sharp and look like one set, and still load fast on an older tablet. It builds on [ADR 0006](../adr/0006-lessons-and-games.md) and [`apps/web/public/media/words/README.md`](../../apps/web/public/media/words/README.md). The README is the short checklist for adding files. This page explains why, and covers what is still to be built.

## Where we are (November 2026)

| Topic    | Today                                                                                     | Problem                                                                                                  |
| -------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Files    | 20 WebP files, 1024 × 1024, 15–64 KB (31 KB on average)                                   | None. Sizes are good.                                                                                    |
| Variants | One size for every screen                                                                 | The memory board decodes twelve 1024 px images for tiles of about 250 CSS px: about 4 MB of memory each. |
| Caching  | Next.js serves `public/` with `Cache-Control: public, max-age=0` and an ETag              | Every image costs a request to the server on every view, even when it hasn't changed.                    |
| Markup   | Plain `<img>` with `decoding="async"`. The lesson preloads the next card with `preload()` | Good. The memory game doesn't wait for its pictures before the first flip.                               |
| Checks   | `test_media.py`: the files and `WORD_IMAGES` agree                                        | Nothing checks size, dimensions or transparency.                                                         |

## 1. The artwork (illustrator)

These rules decide quality more than any later step does.

- **Format of the master:** PNG, **2048 × 2048**, sRGB, transparent background. A vector source (SVG, AI) is even better: keep it as the master. Masters stay outside the repository, in the shared drive, named by word number (`0011.png`).
- **One canvas for all 300:** the subject is centred and fills about **80 %** of the square, with the same margin all round. A picture that fills the whole square looks bigger than its neighbours on the memory board.
- **One style:** the same outline width, palette and light as the Budva set (words 1–10). Line width is measured at 2048 px, so it stays the same once the image is scaled.
- **No writing in the picture:** no letters, numbers or labels. The Doman lesson never shows a picture and its word together (ADR 0006), so a sign with text on it breaks the method.
- **One clear thing:** one object, or one child doing one action. The content manifest's "Notes for the illustrator" lists the hard words: colours, _zmaj_, and the verbs.
- **Contrast:** the subject must read on white (the cards) and on cream `#FFF7E6`. Avoid pale yellow or white edges with no outline.

## 2. Converting (one script, not by hand)

Use one script for all images, so every PR makes the files the same way. It goes in the repo as `scripts/word-images.sh` (to build, see the tickets below). It does the following:

1. Reads `NNNN.png` masters from a folder.
2. Writes **two variants** of each into `apps/web/public/media/words/`:
   - `NNNN.webp`: **1024 × 1024**, for the lesson's big card.
   - `NNNN-512.webp`: **512 × 512**, for the memory and match boards and the place screen's word card.
3. Uses settings that suit flat illustrations:
   ```bash
   cwebp -q 82 -m 6 -sharp_yuv -alpha_q 100 -resize 1024 1024 0011.png -o 0011.webp
   cwebp -q 80 -m 6 -sharp_yuv -alpha_q 100 -resize 512 512   0011.png -o 0011-512.webp
   ```
   - `-m 6` is the slowest, best compression. It is only paid once, at build time.
   - `-sharp_yuv` keeps coloured outlines crisp, which matters for drawings with outlines.
   - `-alpha_q 100` keeps the transparent edges clean.
   - Optionally, also try `-lossless` (or `-near_lossless 60`) and keep whichever file is smaller. Flat colour areas are often smaller lossless.
4. Fails if a result is over budget, and prints a table of sizes.

**Budgets:** `NNNN.webp` ≤ **80 KB**, `NNNN-512.webp` ≤ **30 KB**. A chapter is then at most about 1 MB in total, and usually much less. If an image is over budget, simplify the drawing (texture and gradients cost the most). Don't lower the quality below 75.

**Check by eye** before committing: open both variants at 100 % on a dark and a light background. Look for halos at the transparent edge, blotchy flat areas and thin lines that break up.

## 3. Serving and caching

The files are static and change rarely, so the browser should keep them and not ask again.

- **Version in the URL:** the API builds `image_url` as `/media/words/0011.webp?v=<hash>` (and `image_url_512` as `/media/words/0011-512.webp?v=<hash>`, with that file's own hash), where `<hash>` is the first 8 characters of the file's SHA-256. The hashes live in a generated file next to `WORD_IMAGES`, `apps/api/app/modules/content/media_hashes.json`, written by the conversion script (`scripts/word-images.sh --hashes` rewrites it alone). A test fails if a hash doesn't match its file, or a file has no hash (#205). When an image is redrawn, its hash changes, so the URL changes too.
- **Cache forever:** in `next.config.ts` `headers()`, `/media/words/:path*` gets `Cache-Control: public, max-age=31536000, immutable`. That's safe because a changed file always gets a new URL.
- **Caddy:** nothing to add. WebP is already compressed, so `encode` doesn't help, but it does no harm.
- **Later:** moving to object storage or a CDN only changes the URL prefix in `word_image_url()` and `word_image_url_512()`. The contract stays the same (ADR 0006). An offline service worker, if one comes, caches `/media/words/*` cache-first.

## 4. In the app

**Use plain `<img>`, not `next/image`.** The files are already the right format and size, so `next/image` would only add an optimiser in the web container (CPU and memory on the server) for no gain. Keep the `eslint-disable` comment that says why.

**Pick the variant with `srcSet` and `sizes`,** so the browser chooses the right one for the screen:

```tsx
<img
  src={word.imageUrl} // 1024
  srcSet={`${word.imageUrl512} 512w, ${word.imageUrl} 1024w`}
  sizes="(min-width: 768px) 25vw, 33vw" // the tile's real width
  width={1024}
  height={1024}
  alt=""
  decoding="async"
  draggable={false}
/>
```

The API sends both URLs, `image_url` and `image_url_512` (both `null` for a word without a picture), so the client never guesses file names (#206). Every screen renders them through one component, `WordImage` (`apps/web/src/components/ui/WordImage.tsx`), with its own `sizes`.

**Each screen:**

| Screen                    | Variant          | Loading                                                                                                                                                            |
| ------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Lesson card               | 1024             | First card: `fetchPriority="high"`, not lazy. Next card: `preload()` with the same `srcSet`. This is the one place where sharpness matters most.                   |
| Memory board              | 512              | Before the board is playable, load **and decode** all of its pictures (`img.decode()`), so a card never flips to an empty face. Show card-shaped blocks meanwhile. |
| Match (one picture/round) | 1024 on a tablet | As the memory board: every round's picture is decoded before the first round, with the round's shape as blocks meanwhile.                                          |
| Sastavi riječi            | 1024 on a tablet | Next round: `preload()` with the same `srcSet`, as the lesson.                                                                                                     |
| Place screen word card    | 512              | `loading="lazy"`.                                                                                                                                                  |

The column says which file the screen's `sizes` picks on a tablet at 2×; the browser makes the choice. The wait is `useWordPicturesReady` (`apps/web/src/components/ui/use-word-pictures-ready.ts`). It decodes off-screen `Image`s with the screen's own `srcSet` and `sizes`, so the cards find the same file in the cache. A picture that fails counts as ready (its card shows the placeholder), and after 8 seconds the game starts anyway, so a stalled connection never leaves a child on the skeleton.

**Avoid layout shift:** every image sits in a box with a fixed aspect ratio (the cards already do this), plus `width`/`height` on the `<img>`.

**When an image is missing** (`image_url` is `null`, or the file fails to load): show `PlaceholderArt`, as the place screen already does, and never a broken-image icon. An `onError` on the `<img>` switches to the placeholder, and so does a file that failed before the page hydrated (`complete` with no `naturalWidth`).

**Accessibility:** the picture stays `alt=""` where the word is given by a wrapper's `aria-label` (as in `LessonCards`), so a screen reader doesn't read it twice.

## 5. Checks in CI

Extend `test_media.py`, or add a small script that CI runs. It should check that for every number in `WORD_IMAGES`:

- both variants exist, at 1024 × 1024 and 512 × 512;
- each is within its byte budget;
- each has an alpha channel (WebP `VP8X` with the alpha flag);
- its hash in `media_hashes.json` matches the file.

Then a too-big or wrongly sized image fails in the PR, not on a child's tablet.

## 6. Measuring

- **Lighthouse** (mobile, throttled) on a lesson and on the memory game. Track LCP on the lesson: the first card is the LCP element, and the target is under 2.5 s.
- **A real old tablet:** check that the memory board flips smoothly. If it stutters, decoded image memory is the first suspect, and that is why the boards use the 512 variant.
- **Network panel:** a second visit to the same lesson should load no images from the network.
