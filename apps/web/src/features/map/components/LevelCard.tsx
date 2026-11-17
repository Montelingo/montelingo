"use client";

import { StarIcon } from "@heroicons/react/24/outline";
import { XMarkIcon } from "@heroicons/react/24/solid";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useId, useRef } from "react";

import { FOCUS_RING } from "@/components/ui/kid-styles";
import { cn } from "@/lib/cn";
import { fredoka } from "@/lib/fonts";

import { CONTENT_LANG } from "../model/content";
import { MAP_GEOMETRY } from "../model/map-geometry";
import { isOpenState } from "../model/map-state";
import {
  LEVEL_CARD_PARAM,
  type MapPlace,
  type MapRegion,
} from "../model/map-view";
import { ChromeIcon } from "./ChromeIcon";
import { closeLevelCard } from "./level-card-navigation";
import { MapBaseImage } from "./MapBaseImage";
import { ICON_BUTTON_CLASS } from "./chrome-styles";

type LevelCardProps = {
  regions: readonly MapRegion[];
  places: readonly MapPlace[];
};

// The level card (Figma "M2 · Level card"): opened by a tap on an open place,
// or the next stop's play button, as `?place=<id>` on the map's URL, so Back
// closes it and a link to it works. A bottom sheet on phones and portrait
// tablets, a centred card from 1024px wide. It shows the place's number and
// region, a picture of it from the map, its stars (none earned yet), and
// "Kreni!", which opens the place. A native modal <dialog>: it keeps focus
// inside, and Escape or a tap on the backdrop closes it.
export function LevelCard({ regions, places }: LevelCardProps) {
  const searchParams = useSearchParams();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  const placeId = searchParams.get(LEVEL_CARD_PARAM);
  // Only an open place has a card; any other id in the URL is ignored.
  const place =
    places.find(({ id, state }) => id === placeId && isOpenState(state)) ??
    null;
  const region = regions.find(({ id }) => id === place?.regionId) ?? null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (place !== null && dialog !== null && !dialog.open) {
      dialog.showModal();
    }
  }, [place]);

  if (place === null) {
    return null;
  }

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- the backdrop tap is a pointer-only extra; the keyboard closes the dialog with Escape (native to a modal <dialog>) or the close button
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={closeLevelCard}
      // A tap on the backdrop lands on the dialog itself, outside the card.
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          dialogRef.current?.close();
        }
      }}
      className={cn(
        fredoka.className,
        "m-0 mt-auto w-full max-w-none bg-transparent p-0 backdrop:bg-kid-ink/40 lg:m-auto lg:w-[26rem]",
      )}
    >
      <div className="flex flex-col gap-3.5 rounded-t-kid-xl border-t-3 border-kid-ink bg-kid-cream px-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] pt-6 lg:rounded-kid-xl lg:border-3 lg:pb-6 lg:shadow-raised-6">
        <span
          aria-hidden="true"
          className="mx-auto h-1.5 w-12 rounded-badge bg-kid-line lg:hidden"
        />
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-14 shrink-0 items-center justify-center rounded-full border-3 border-kid-ink bg-kid-yellow text-2xl font-semibold text-kid-ink ring-4 ring-kid-yellow/40"
          >
            {place.order}
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span
              lang={CONTENT_LANG}
              className="truncate text-sm font-medium uppercase text-kid-muted"
            >
              {region?.name} · mjesto {place.order}
            </span>
            <h2
              id={titleId}
              lang={CONTENT_LANG}
              className="truncate text-4xl font-semibold leading-tight text-kid-ink"
            >
              {place.name}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Zatvori"
            onClick={() => dialogRef.current?.close()}
            className={ICON_BUTTON_CLASS}
          >
            <XMarkIcon aria-hidden="true" className="size-8 text-kid-ink" />
          </button>
        </div>
        <PlacePicture place={place} />
        <div
          role="img"
          aria-label="0 od 3 zvjezdice"
          className="flex justify-center gap-2"
        >
          {[0, 1, 2].map((star) => (
            <StarIcon
              key={star}
              aria-hidden="true"
              className="size-10 fill-white stroke-kid-ink stroke-2"
            />
          ))}
        </div>
        <Link
          href={place.href}
          className={cn(
            "flex h-16 items-center justify-center gap-2 rounded-kid-lg border-3 border-kid-ink bg-kid-coral text-2xl font-semibold text-kid-ink shadow-raised-6",
            FOCUS_RING,
          )}
        >
          <ChromeIcon name="play" size={28} />
          Kreni!
        </Link>
      </div>
    </dialog>
  );
}

// How much of the map the picture shows, in the map's units: about a town
// and its neighbours.
const PICTURE_WIDTH = 220;
const PICTURE_RATIO = 336 / 170;

// The place on the map, close up: the map's own art (the country, the
// region's decorations and buildings), centred on the place's building. Left
// out on a short screen (a phone on its side), so the card fits without
// scrolling.
function PlacePicture({ place }: { place: MapPlace }) {
  const geometry =
    MAP_GEOMETRY.locations[place.id as keyof typeof MAP_GEOMETRY.locations];
  const [, , mapWidth, mapHeight] = MAP_GEOMETRY.viewBox;
  if (geometry === undefined) {
    return null;
  }
  const { art } = geometry;
  const height = PICTURE_WIDTH / PICTURE_RATIO;
  const x = art.x + art.width / 2 - PICTURE_WIDTH / 2;
  const y = art.y + art.height / 2 - height / 2;
  return (
    <svg
      aria-hidden="true"
      viewBox={`${x} ${y} ${PICTURE_WIDTH} ${height}`}
      className="aspect-[336/170] w-full rounded-kid border-3 border-kid-ink bg-kid-sea short:hidden"
    >
      <MapBaseImage />
      <image
        href={`/maps/decorations-${place.regionId}.svg`}
        width={mapWidth}
        height={mapHeight}
      />
      <image
        href={`/maps/places-${place.regionId}.svg`}
        width={mapWidth}
        height={mapHeight}
      />
    </svg>
  );
}
