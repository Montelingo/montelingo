import { PickerScreenSkeleton } from "./PickerScreenSkeleton";

// There are three regions (ADR 0005).
const REGION_COUNT = 3;

/** Stands in for MapHome while /play loads. */
export function MapHomeSkeleton() {
  return <PickerScreenSkeleton cardCount={REGION_COUNT} />;
}
