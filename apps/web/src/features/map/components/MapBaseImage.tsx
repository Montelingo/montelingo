import { MAP_GEOMETRY } from "../model/map-geometry";

/** The base art's file, which MapScreenSkeleton preloads. */
export const MAP_BASE_IMAGE_URL = "/maps/base.svg";

// The map's base art: the sea, the country and its surroundings, which go on
// past the export's edges so they fill a screen of any shape.
export function MapBaseImage() {
  const [x, y, width, height] = MAP_GEOMETRY.baseBox;
  return (
    <image
      href={MAP_BASE_IMAGE_URL}
      x={x}
      y={y}
      width={width}
      height={height}
    />
  );
}
