# Content manifest

This is the approved list of regions, locations and chapters for phase 1. The vocabulary comes from the recording list: 30 chapters of 10 words, 300 words in total. The data itself is in [`content.json`](../../apps/api/app/modules/content/data/content.json). This file records what was approved and who approved it. To change a word, open a pull request against the data file. Do not edit the PDF.

## Sign-off

| Check                                            | Who    | Date   |
| ------------------------------------------------ | ------ | ------ |
| Language review (Montenegrin standard, spelling) | `TODO` | `TODO` |
| Product                                          | `TODO` | `TODO` |
| Frontend                                         | `TODO` | `TODO` |
| Design                                           | `TODO` | `TODO` |

The language review changed `TODO: no words / the words listed in #NN`.

**Status: frozen.** The 17 location IDs and 30 chapter IDs below must not change (SVG map contract §21). The final map uses them as `region-<id>` and `location-<id>`. Renaming an ID means a new sign-off from Product, Frontend and Design.

## Starting location

The starting location is **Budva** (`budva`). In phase 1 it is the only `available` location, and every other location is `locked`. The data file records it as `starting_location` and `is_starting`.

## Regions and locations

IDs use English kebab-case, as the SVG map contract §4 requires.

| Region              | ID        | Locations (ID)                                                                                                                                   | Chapters | Words   |
| ------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ------- |
| Obala               | `coast`   | Budva (`budva`), Kotor (`kotor`), Ulcinj (`ulcinj`), Herceg Novi (`herceg-novi`), Tivat (`tivat`), Bar (`bar`)                                   | 10       | 1–100   |
| Centralna Crna Gora | `central` | Podgorica (`podgorica`), Cetinje (`cetinje`), Nikšić (`niksic`), Danilovgrad (`danilovgrad`), Skadarsko jezero (`skadar-lake`)                   | 10       | 101–200 |
| Sjever i planine    | `north`   | Durmitor / Žabljak (`durmitor`), Kolašin (`kolasin`), Berane (`berane`), Bijelo Polje (`bijelo-polje`), Pljevlja (`pljevlja`), Rožaje (`rozaje`) | 10       | 201–300 |

## Chapters

Chapters are listed in recording order. A word's number is also the name of its future audio file, so word 27 is `0027.mp3`.

| #   | Location       | Chapter ID                    | Title                    | Words   |
| --- | -------------- | ----------------------------- | ------------------------ | ------- |
| 1   | `budva`        | `budva-beach`                 | Na plaži                 | 1–10    |
| 2   | `kotor`        | `kotor-harbour`               | U luci                   | 11–20   |
| 3   | `ulcinj`       | `ulcinj-sea-animals`          | Morske životinje         | 21–30   |
| 4   | `herceg-novi`  | `herceg-novi-seaside-walk`    | Šetnja uz more           | 31–40   |
| 5   | `tivat`        | `tivat-travel`                | Putujemo                 | 41–50   |
| 6   | `bar`          | `bar-market-fruit`            | Voće na pijaci           | 51–60   |
| 7   | `budva`        | `budva-summer-clothes`        | Ljeto i odjeća           | 61–70   |
| 8   | `kotor`        | `kotor-colours`               | Boje oko nas             | 71–80   |
| 9   | `ulcinj`       | `ulcinj-play`                 | Igramo se                | 81–90   |
| 10  | `herceg-novi`  | `herceg-novi-seaside-actions` | Šta radimo na obali      | 91–100  |
| 11  | `podgorica`    | `podgorica-home`              | Kod kuće                 | 101–110 |
| 12  | `cetinje`      | `cetinje-family`              | Porodica                 | 111–120 |
| 13  | `niksic`       | `niksic-at-the-table`         | Za stolom                | 121–130 |
| 14  | `podgorica`    | `podgorica-vegetables`        | Povrće i ručak           | 131–140 |
| 15  | `podgorica`    | `podgorica-kitchen`           | U kuhinji                | 141–150 |
| 16  | `cetinje`      | `cetinje-body`                | Moje tijelo              | 151–160 |
| 17  | `danilovgrad`  | `danilovgrad-getting-dressed` | Oblačimo se              | 161–170 |
| 18  | `podgorica`    | `podgorica-kindergarten`      | U vrtiću                 | 171–180 |
| 19  | `cetinje`      | `cetinje-music`               | Muzika i slavlje         | 181–190 |
| 20  | `skadar-lake`  | `skadar-lake-lakeside`        | Pored jezera             | 191–200 |
| 21  | `durmitor`     | `durmitor-mountain`           | Na planini               | 201–210 |
| 22  | `kolasin`      | `kolasin-forest`              | U šumi                   | 211–220 |
| 23  | `berane`       | `berane-forest-animals`       | Šumske životinje         | 221–230 |
| 24  | `bijelo-polje` | `bijelo-polje-village`        | Na selu                  | 231–240 |
| 25  | `pljevlja`     | `pljevlja-farmyard`           | Seosko dvorište          | 241–250 |
| 26  | `kolasin`      | `kolasin-meadow`              | Livada i mali stanovnici | 251–260 |
| 27  | `durmitor`     | `durmitor-weather`            | Vrijeme i priroda        | 261–270 |
| 28  | `rozaje`       | `rozaje-winter`               | Zima i topla odjeća      | 271–280 |
| 29  | `berane`       | `berane-counting`             | Brojimo                  | 281–290 |
| 30  | `bijelo-polje` | `bijelo-polje-daily-actions`  | Svakodnevne radnje       | 291–300 |

## Notes for the illustrator

Each word gets one picture. The words below are hard to show as one clear object, so they need an agreed approach before drawing starts.

**Words with two meanings.** Draw the meaning given here:

- 86 _zmaj_: a kite, not a dragon.

**Colours (71–80):** crvena, plava, žuta, zelena, bijela, crna, narandžasta, ljubičasta, ružičasta, smeđa. A patch of colour on its own is easy to misread. Use one simple object that is clearly that colour, and keep the same object across all ten if possible.

**Verbs, seaside (91–100):** plivati, roniti, veslati, šetati, trčati, skakati, bacati, hvatati, graditi, tražiti.

**Verbs, daily (291–300):** jesti, piti, spavati, sjedjeti, stajati, hodati, gledati, slušati, pjevati, igrati.

Show each verb as a child in the middle of the action. Some pairs are easy to confuse: _šetati_, _hodati_ and _trčati_; _sjedjeti_ and _stajati_; _gledati_ and _tražiti_; _bacati_ and _hvatati_. Draw each pair so the difference is obvious.

`TODO: words Design or the illustrator added`
