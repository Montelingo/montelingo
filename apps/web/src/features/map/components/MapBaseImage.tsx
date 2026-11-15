import { MAP_GEOMETRY } from "../model/map-geometry";

// The map's base art: the sea, the country and its surroundings, which go on
// past the export's edges so they fill a screen of any shape.
export function MapBaseImage() {
  const [x, y, width, height] = MAP_GEOMETRY.baseBox;
  return (
    <image href="/maps/base.svg" x={x} y={y} width={width} height={height} />
  );
}
