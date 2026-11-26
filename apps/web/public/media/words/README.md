# Word images

One picture per word, served as static files at `/media/words/<file>` (ADR 0006). Why these rules: [`docs/architecture/word-images.md`](../../../../../docs/architecture/word-images.md).

- **Name:** the word's recording number, four digits: word 1 is `0001.webp`. It is the same number as the future audio file (`0001.mp3`) and is stable across environments.
- **Two files per word**, both WebP, square, with a transparent background:

  | File            | Size        | Budget | Used for                                      |
  | --------------- | ----------- | ------ | --------------------------------------------- |
  | `NNNN.webp`     | 1024 × 1024 | 80 KB  | The lesson's big card                         |
  | `NNNN-512.webp` | 512 × 512   | 30 KB  | The memory and match boards, the place screen |

- **Source files:** the illustrator's 2048 px PNG masters, named `NNNN.png`, stay outside the repository. Commit only the WebP files.
- **Data:** a word gets its image only when its number is in `WORD_IMAGES` (`apps/api/app/modules/content/media.py`). Add the number there in the same pull request as the files. `apps/api/tests/unit/modules/content/test_media.py` fails if the list and the files disagree, or if a file has the wrong size, is over budget or has no alpha channel.
- **Hashes:** the browser keeps these files for a year (`Cache-Control: immutable`), so the API adds the file's hash to each URL (`0011.webp?v=<hash>`) and a redrawn image gets a new URL. The script writes the hashes to `apps/api/app/modules/content/media_hashes.json`. Commit that file with the images. `test_media.py` fails if a hash doesn't match its file. After changing or removing a file by hand, run `scripts/word-images.sh --hashes`.

Make both files with the script, never by hand (Fedora: `sudo dnf install libwebp-tools`):

```bash
scripts/word-images.sh ~/masters/kotor
```

It reads every `NNNN.png` in the folder, writes both variants here, updates `media_hashes.json`, prints their sizes and fails if one is over budget. If an image is over budget, simplify the drawing. Don't lower the quality. A folder of 1024 px `NNNN.webp` files also works when the PNG master is lost: the 1024 file is copied unchanged, and only the 512 file is made.

| Numbers | Chapter                           | Added in |
| ------- | --------------------------------- | -------- |
| 1–10    | Na plaži (Budva)                  | #127     |
| 11–20   | U luci (Kotor)                    | #188     |
| 21–30   | Morske životinje (Ulcinj)         | #189     |
| 31–40   | Šetnja uz more (Herceg Novi)      | #190     |
| 41–50   | Putujemo (Tivat)                  | #191     |
| 51–60   | Voće na pijaci (Bar)              | #192     |
| 61–70   | Ljeto i odjeća (Budva)            | #120     |
| 71–80   | Boje oko nas (Kotor)              | #188     |
| 81–90   | Igramo se (Ulcinj)                | #189     |
| 91–100  | Šta radimo na obali (Herceg Novi) | #190     |
| 101–110 | Kod kuće (Podgorica)              | #193     |
| 111–120 | Porodica (Cetinje)                | #194     |
| 121–130 | Za stolom (Nikšić)                | #195     |
| 131–140 | Povrće i ručak (Podgorica)        | #193     |
| 141–150 | U kuhinji (Podgorica)             | #193     |
| 151–160 | Moje tijelo (Cetinje)             | #194     |
| 161–170 | Oblačimo se (Danilovgrad)         | #196     |
| 171–180 | U vrtiću (Podgorica)              | #193     |
| 181–190 | Muzika i slavlje (Cetinje)        | #194     |
