import type { RegionPickerRegion } from "../model/map-state";
import type { MapNotice } from "../model/notices";
import { needsProgressRetry } from "../model/screens";
import { PickerScreen } from "./PickerScreen";
import { RegionPicker } from "./RegionPicker";

type MapHomeProps = {
  regions: readonly RegionPickerRegion[];
  /** Why the learner was sent here, from the page's `?notice=`. */
  notice: MapNotice | null;
};

// The learner's home, /play: every region, open or not, to pick from.
export function MapHome({ regions, notice }: MapHomeProps) {
  return (
    <PickerScreen
      title="Your map"
      subtitle="Pick a region to explore."
      notice={notice}
      needsProgressRetry={needsProgressRetry(regions)}
    >
      <RegionPicker regions={regions} />
    </PickerScreen>
  );
}
