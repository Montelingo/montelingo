import type { MapNotice } from "../model/notices";
import { needsProgressRetry, type RegionScreenData } from "../model/screens";
import { LocationPicker } from "./LocationPicker";
import { PickerScreen } from "./PickerScreen";

type RegionScreenProps = RegionScreenData & {
  /** Why the learner was sent here, from the page's `?notice=`. */
  notice: MapNotice | null;
};

// A region, /play/<region>: its locations, open or not, to pick from.
export function RegionScreen({ region, locations, notice }: RegionScreenProps) {
  return (
    <PickerScreen
      title={region.name}
      subtitle="Pick a place to explore."
      notice={notice}
      needsProgressRetry={needsProgressRetry([region, ...locations])}
    >
      <LocationPicker locations={locations} />
    </PickerScreen>
  );
}
