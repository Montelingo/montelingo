import { PickerScreenSkeleton } from "./PickerScreenSkeleton";

// A region has five or six locations; six fills two rows on a tablet either way.
const LOCATION_COUNT = 6;

/** Stands in for RegionScreen while a region loads. */
export function RegionScreenSkeleton() {
  return <PickerScreenSkeleton cardCount={LOCATION_COUNT} />;
}
