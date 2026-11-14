# SVG map contract

The interactive map of Montenegro comes from the designers' Figma file, page **4 · Map handoff (developers)**. This is the contract between that export and the app. The places on the map are the ones in the [content manifest](content-manifest.md), with the same ids.

## The export

- Export the frame **EXPORT → montenegro-map.svg** as SVG with **Include id attribute** and **Outline text** on. Every changeable layer is switched on in that frame, because hidden layers are not exported.
- The viewBox is `0 0 1600 1000`, with nothing outside it. Delete the fixed `width` and `height` that Figma writes.
- The export is vector only: no images, scripts or text elements, and no masks or clip paths.
- Every id is lowercase-hyphen and unique. Layers have no transforms, so every coordinate is absolute in the viewBox.
- The app does not use the export directly. `apps/web/scripts/build_map.py` splits it (see [frontend architecture §8.2](../frontend-architecture.md)):

  ```bash
  cd apps/web
  uv run --no-project --with shapely python scripts/build_map.py path/to/montenegro-map.svg
  ```

## Ids

There are three regions, and their places, all with content-manifest ids:

| Region           | Places                                                                              |
| ---------------- | ----------------------------------------------------------------------------------- |
| `region-coast`   | `location-budva`, `-tivat`, `-kotor`, `-herceg-novi`, `-bar`, `-ulcinj`             |
| `region-central` | `location-cetinje`, `-podgorica`, `-danilovgrad`, `-niksic`, `-skadar-lake`         |
| `region-north`   | `location-kolasin`, `-durmitor`, `-pljevlja`, `-bijelo-polje`, `-berane`, `-rozaje` |

- **Inside every `location-<id>`:**
  - `location-<id>-visual`, holding `illustration-<id>`, `label-<id>` and `leader-line-<id>`
  - `marker-<id>` (the state badge)
  - `decoration-<id>-completed` (a flag)
  - `hit-area-<id>`
- **Every region group** also contains:
  - `region-<id>-shape`
  - `scenery-<id>`
  - `decorations-<id>`
  - `overlay-fog-<id>`, holding `fog-veil-<id>` and `cloud-<id>-n`
  - `status-region-<id>`
- **Top level:** `background` (with `country-outline` and `neighbours`), `map-title`, `compass`, `rewards` and `guide-eagle`.

## States

These follow the server's states (ADR 0005), plus the ones only the screen uses. A state is never shown by colour alone.

- **A place** can be:

  - `locked`: a lock
  - `available`: its number in its region
  - `active`
  - `in-progress`: an arc
  - `completed`: a green disc with a tick
  - `loading`: a dashed ring and dots
  - `error`: a soft coral disc with a retry arrow

  The one next place to go has a ring.

- **A region** is locked (fog over it, its places hidden), available, in progress (its count of done places), or completed.

## What the app does differently from the export

The script keeps the art and redraws what changes with state or language. The app draws these itself, so the export's versions are left out:

- Markers, name pills, region chips, completed flags and hit areas.
- Every outlined text, which is English in the export. The app draws Montenegrin.
- Its own decisions on the export's art:
  - **The whole map and a zoomed region are two levels.** The whole map shows each region's name and a dot per place. A region's screen shows its buildings, markers and names, at a size for that zoom.
  - **Coastal towns sit on the coastline.** Their marker is on the shore and their building just inland, instead of the export's markers out at sea with leader lines.
  - **Place positions follow real geography where the export's are off.** Herceg Novi is at the mouth of the Bay of Kotor, Tivat on its south shore, and Kotor in its south-east corner (`COASTAL_TOWNS`).
  - **The region borders are redrawn:** one border per region, gently curved. Obala is the strip along the sea. Skadarsko jezero belongs to Centralna Crna Gora and stops at the Albanian border.
  - **Decorations that are not places are left out:** Perast, Sveti Stefan, Ostrog, the Millennium Bridge, and Tivat's palm island. So are the title box, the rewards and the guide eagle, which come later.
  - **The neighbouring countries are one landscape with no borders between them**, muted and darker, with scenery like Montenegro's.

## Still open with the designers

- **Tablet sizes.** The previews use iPad 11" (1194 × 834 and 834 × 1194). In portrait the map fills the height and pans sideways.
- **Which completed decorations to show.**
- **Zoom states for the whole map and a region**, now that the app uses two levels.
- **Region display names.** The app uses the content's names (Obala, Centralna Crna Gora, Sjever i planine), not the export's English ones (The Coast, The Heartland, The Wild North).
