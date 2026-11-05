import { CardGrid } from "@/components/ui/CardGrid";
import { PlaceholderArt } from "@/components/ui/PlaceholderArt";
import { TileCard } from "@/components/ui/TileCard";

import type {
  LocationPickerLocation,
  OnLocationSelect,
} from "../model/map-state";

type LocationPickerProps = {
  /** A region's locations, in the order to show them, each with its state and link. */
  locations: readonly LocationPickerLocation[];
  /** Called with a location's id as its open card navigates. */
  onLocationSelect?: OnLocationSelect;
};

// A region's locations as cards, and nothing else, like RegionPicker (see
// there for why it has no "use client"). Towns and other places look the same.
export function LocationPicker({
  locations,
  onLocationSelect,
}: LocationPickerProps) {
  return (
    <CardGrid label="Places">
      {locations.map(({ id, name, state, href, isNext }) => (
        <TileCard
          key={id}
          title={name}
          state={state}
          href={href}
          isNext={isNext}
          nextLabel="Next stop"
          picture={<PlaceholderArt id={id} label={name} />}
          lockedMessage={`${name} isn’t open yet.`}
          onActivate={onLocationSelect ? () => onLocationSelect(id) : undefined}
        />
      ))}
    </CardGrid>
  );
}
