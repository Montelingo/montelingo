import { MAP_GEOMETRY } from "../model/map-geometry";
import { MapBaseImage } from "./MapBaseImage";

// The whole country with a little margin, so all three regions show whole,
// and more below it, so the south coast stays clear of the Montelingo badge
// in the frame's bottom-left corner.
const MARGIN = 30;
const BADGE_ROOM = 220;
const VIEW = {
  x: MAP_GEOMETRY.focus.x - MARGIN,
  y: MAP_GEOMETRY.focus.y - MARGIN,
  width: MAP_GEOMETRY.focus.width + 2 * MARGIN,
  height: MAP_GEOMETRY.focus.height + 2 * MARGIN + BADGE_ROOM,
};

const REGIONS = ["coast", "central", "north"] as const;

// The map's art as a picture, for the welcome and setup screens (Figma "1 ·
// Welcome & Auth"): every region's scenery and buildings, with no state,
// names or controls. The country fits its box whole, and the art around it
// (the sea and the neighbours, which go on past the export's edges) fills the
// rest. Decorative: hidden from screen readers.
export function MapArt() {
  const [, , width, height] = MAP_GEOMETRY.viewBox;
  return (
    <svg
      aria-hidden="true"
      viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.width} ${VIEW.height}`}
      preserveAspectRatio="xMidYMid meet"
      className="absolute inset-0 size-full overflow-hidden"
    >
      <MapBaseImage />
      {REGIONS.map((region) => (
        <image
          key={`decorations-${region}`}
          href={`/maps/decorations-${region}.svg`}
          width={width}
          height={height}
        />
      ))}
      {REGIONS.map((region) => (
        <image
          key={`places-${region}`}
          href={`/maps/places-${region}.svg`}
          width={width}
          height={height}
        />
      ))}
    </svg>
  );
}
