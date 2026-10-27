import { CardGrid } from "@/components/ui/CardGrid";
import { PlaceholderArt } from "@/components/ui/PlaceholderArt";
import { TileCard } from "@/components/ui/TileCard";

import type { OnRegionSelect, RegionPickerRegion } from "../model/map-state";

type RegionPickerProps = {
  /** Every region, in the order to show them, each with its state and link. */
  regions: readonly RegionPickerRegion[];
  /** Called with a region's id as its open card navigates. */
  onRegionSelect?: OnRegionSelect;
};

// The regions as cards, and nothing else: the screen around it owns the
// heading and notices, so the SVG map can replace this component with the
// same props. It imports only the map contract's types from the feature.
//
// No "use client": TileCard is the client boundary. The server screens leave
// onRegionSelect out (a function cannot cross from a Server Component to a
// Client Component), and a client parent that passes one renders this on the
// client too. Each card is a real link either way.
export function RegionPicker({ regions, onRegionSelect }: RegionPickerProps) {
  return (
    <CardGrid label="Regions">
      {regions.map(({ id, name, state, href }) => (
        <TileCard
          key={id}
          title={name}
          state={state}
          href={href}
          picture={<PlaceholderArt id={id} label={name} />}
          lockedMessage={`${name} isn’t open yet.`}
          onActivate={onRegionSelect ? () => onRegionSelect(id) : undefined}
        />
      ))}
    </CardGrid>
  );
}
