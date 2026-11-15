# Word images

One picture per word, served as static files at `/media/words/<file>` (ADR 0006).

- **Name:** the word's recording number, four digits: word 1 is `0001.webp`. It is the same number as the future audio file (`0001.mp3`) and is stable across environments.
- **Format:** WebP, square, 1024 × 1024, transparent background, at most 150 KB.
- **Source files:** keep the original PNGs outside the repository. Commit only the WebP files.
- **Data:** a word gets its image only when its number is in `WORD_IMAGES` (`apps/api/app/modules/content/media.py`). Add the number there in the same pull request as the file.

To convert a PNG (Fedora: `sudo dnf install libwebp-tools`):

```bash
cwebp -q 80 -resize 1024 1024 -alpha_q 100 0011.png -o 0011.webp
```

| Numbers | Chapter          | Added in |
| ------- | ---------------- | -------- |
| 1–10    | Na plaži (Budva) | #127     |
