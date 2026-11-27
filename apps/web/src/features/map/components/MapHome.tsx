import type { MapData } from "../model/map-view";
import type { MapNotice } from "../model/notices";
import { needsProgressRetry } from "../model/screens";
import { MapScreen } from "./MapScreen";
import { MontenegroMap } from "./MontenegroMap";

type MapHomeProps = MapData & {
  /** Why the learner was sent here, from the page's `?notice=`. */
  notice: MapNotice | null;
};

// The learner's home, /play: the whole country, every place on it. Back leads
// out of the learner area, to where adults find their account.
export function MapHome({
  regions,
  places,
  explorer,
  stars,
  hearts,
  notice,
}: MapHomeProps) {
  return (
    <MapScreen
      title="Mapa"
      regions={regions}
      places={places}
      explorer={explorer}
      stars={stars}
      hearts={hearts}
      focusRegionId={null}
      backHref="/"
      notice={notice}
      needsProgressRetry={needsProgressRetry([...regions, ...places])}
    >
      <MontenegroMap regions={regions} places={places} />
    </MapScreen>
  );
}
