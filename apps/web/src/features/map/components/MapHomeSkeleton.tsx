import { PickerScreenSkeleton } from "./PickerScreenSkeleton";

// How many cards stand in for the regions while /play loads: the three regions
// of phase 1 (ADR 0005). Only the placeholder uses it, to keep the layout from
// shifting when the real cards arrive. Nothing may behave differently because
// there are exactly three regions (SVG map contract §3): the screens draw
// whatever list the API returns. Update it when the region list changes.
const REGION_COUNT = 3;

/** Stands in for MapHome while /play loads. */
export function MapHomeSkeleton() {
  return <PickerScreenSkeleton cardCount={REGION_COUNT} />;
}
