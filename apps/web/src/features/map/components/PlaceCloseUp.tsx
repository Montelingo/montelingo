import { MAP_GEOMETRY } from "../model/map-geometry";
import { MapBaseImage } from "./MapBaseImage";

type PlaceCloseUpProps = {
  placeId: string;
  /** How much of the map to show, in the map's units. */
  width: number;
  height: number;
  className?: string;
};

// A place on the map, close up: the map's own art (the country, the region's
// decorations and buildings), centred on the place's building. LevelCard's
// picture and a place's sticker are both this. Nothing for a place the map
// does not know.
export function PlaceCloseUp({
  placeId,
  width,
  height,
  className,
}: PlaceCloseUpProps) {
  const geometry =
    MAP_GEOMETRY.locations[placeId as keyof typeof MAP_GEOMETRY.locations];
  if (geometry === undefined) {
    return null;
  }
  const [, , mapWidth, mapHeight] = MAP_GEOMETRY.viewBox;
  const { art, regionId } = geometry;
  const x = art.x + art.width / 2 - width / 2;
  const y = art.y + art.height / 2 - height / 2;
  return (
    <svg
      aria-hidden="true"
      viewBox={`${x} ${y} ${width} ${height}`}
      className={className}
    >
      <MapBaseImage />
      <image
        href={`/maps/decorations-${regionId}.svg`}
        width={mapWidth}
        height={mapHeight}
      />
      <image
        href={`/maps/places-${regionId}.svg`}
        width={mapWidth}
        height={mapHeight}
      />
    </svg>
  );
}

/**
 * How much of the map a sticker shows, in the map's units: the place's
 * building and a little around it. Measured from Figma's "Sticker · Kotor",
 * which crops the map to 67.2 units square around Kotor's art.
 */
const STICKER_SIDE = 67.2;

// A place's sticker art (Figma "Sticker · <place>"): not a drawing of its own
// but the map close up and square. Fills its box; the caller makes it round.
export function PlaceStickerArt({
  placeId,
  className,
}: {
  placeId: string;
  className?: string;
}) {
  return (
    <PlaceCloseUp
      placeId={placeId}
      width={STICKER_SIDE}
      height={STICKER_SIDE}
      className={className}
    />
  );
}
