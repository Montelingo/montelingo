import { PLAY_PATH } from "@/features/auth/edge";

import type { RegionMapData } from "../model/map-view";
import type { MapNotice } from "../model/notices";
import { needsProgressRetry } from "../model/screens";
import { MapScreen } from "./MapScreen";
import { MontenegroMap } from "./MontenegroMap";

type RegionScreenProps = RegionMapData & {
  /** Why the learner was sent here, from the page's `?notice=`. */
  notice: MapNotice | null;
};

// A region, /play/<region>: the same map, zoomed to the region. Back leads to
// the whole map.
export function RegionScreen({
  region,
  regions,
  places,
  explorer,
  stars,
  hearts,
  notice,
}: RegionScreenProps) {
  const regionPlaces = places.filter(({ regionId }) => regionId === region.id);
  return (
    <MapScreen
      title={region.name}
      regions={regions}
      places={places}
      explorer={explorer}
      stars={stars}
      hearts={hearts}
      focusRegionId={region.id}
      backHref={PLAY_PATH}
      notice={notice}
      needsProgressRetry={needsProgressRetry([region, ...regionPlaces])}
    >
      <MontenegroMap
        regions={regions}
        places={places}
        focusRegionId={region.id}
      />
    </MapScreen>
  );
}
