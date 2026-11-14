"use client";

import { useRouter } from "next/navigation";
import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/cn";
import { fredoka } from "@/lib/fonts";

import { CONTENT_LANG } from "../model/content";
import { MAP_GEOMETRY } from "../model/map-geometry";
import { isOpenState, type MapElementState } from "../model/map-state";
import {
  isFogged,
  levelCardHref,
  type MapPlace,
  type MapRegion,
  mapViewBox,
} from "../model/map-view";

// The designers' palette for the map.
const INK = "#2B2D42";
const YELLOW = "#FFC93C";
const GREEN = "#2FA35A";
const CORAL = "#FF8A7A";
// The neighbours' names, on the muted land around Montenegro.
const NEIGHBOUR = "#F3F6FB";
const FOCUS = "#4F46E5";

const STATUS_LABELS: Record<MapElementState, string> = {
  locked: "zaključano",
  available: "otvoreno",
  active: "odabrano",
  "in-progress": "u toku",
  completed: "završeno",
  loading: "učitava se",
  error: "nije učitano",
};

const NEXT_LABEL = "sljedeće mjesto";

const NEIGHBOUR_NAMES: Record<string, string> = {
  "bosnia-herzegovina": "BOSNA I HERCEGOVINA",
  serbia: "SRBIJA",
  kosovo: "KOSOVO",
  albania: "ALBANIJA",
  croatia: "HRVATSKA",
};

type Geometry = typeof MAP_GEOMETRY;
type RegionId = keyof Geometry["regions"];
type LocationId = keyof Geometry["locations"];
type LocationGeometry = Geometry["locations"][LocationId];
type RegionGeometry = Geometry["regions"][RegionId];

function regionGeometry(id: string): RegionGeometry | undefined {
  return MAP_GEOMETRY.regions[id as RegionId];
}

function locationGeometry(id: string): LocationGeometry | undefined {
  return MAP_GEOMETRY.locations[id as LocationId];
}

type MontenegroMapProps = {
  regions: readonly MapRegion[];
  places: readonly MapPlace[];
  /** Zooms to this region; `null` shows the whole country. */
  focusRegionId?: string | null;
};

// The illustrated map from the designers' Figma export, at two levels. The
// whole country shows each region's name on the region and a dot for each
// of its towns; a tap on a region zooms to it (its own page), which shows its
// buildings, and each town's marker and name. A locked region shows no towns,
// only its fog and its name. The art is cached images; what changes with
// state or language is drawn here over it, in Montenegrin. A closed region or
// town stays focusable and answers a tap by saying why it will not open.
export function MontenegroMap({
  regions,
  places,
  focusRegionId = null,
}: MontenegroMapProps) {
  const router = useRouter();
  const [message, setMessage] = useState<{ text: string; key: number } | null>(
    null,
  );
  const view = mapViewBox(focusRegionId);
  const [, , fullWidth, fullHeight] = MAP_GEOMETRY.viewBox;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const focusRegion = regions.find(({ id }) => id === focusRegionId) ?? null;
  const openRegionIds = new Set(
    regions.filter(({ state }) => !isFogged(state)).map(({ id }) => id),
  );
  const nextPlace = places.find(({ isNext }) => isNext);
  const nextDot =
    nextPlace === undefined ? undefined : locationGeometry(nextPlace.id)?.dot;
  const panTarget =
    nextDot !== undefined &&
    (focusRegionId === null || nextPlace?.regionId === focusRegionId)
      ? nextDot
      : { cx: view.x + view.width / 2, cy: view.y + view.height / 2 };

  // The map covers the whole screen, so on a screen of another shape than the
  // map's it overflows one way and pans (in portrait, sideways: the whole
  // country would be too small to tap). It starts with the next place in the
  // middle.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller === null) {
      return;
    }
    const fx = (panTarget.cx - view.x) / view.width;
    const fy = (panTarget.cy - view.y) / view.height;
    scroller.scrollLeft = fx * scroller.scrollWidth - scroller.clientWidth / 2;
    scroller.scrollTop = fy * scroller.scrollHeight - scroller.clientHeight / 2;
  }, [panTarget.cx, panTarget.cy, view.x, view.y, view.width, view.height]);

  function say(text: string) {
    setMessage((previous) => ({ text, key: (previous?.key ?? 0) + 1 }));
  }

  function activate(href: string, isOpen: boolean, closedText: string) {
    if (isOpen) {
      router.push(href);
    } else {
      say(closedText);
    }
  }

  // The other regions, as on the whole map: names and dots, to go to. Zoomed
  // in, their names shrink by the zoom, so they keep their size on screen.
  const overviewRegions = regions.filter(({ id }) => id !== focusRegionId);
  const nameScale =
    focusRegionId === null ? 1 : (regionGeometry(focusRegionId)?.scale ?? 1);

  return (
    <>
      <div ref={scrollerRef} className="fixed inset-0 overflow-auto">
        <svg
          viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
          lang={CONTENT_LANG}
          aria-label={
            focusRegion === null
              ? "Mapa Crne Gore"
              : `Mapa Crne Gore, regija ${focusRegion.name}`
          }
          role="group"
          className={cn(
            fredoka.className,
            "block aspect-[16/10] w-[max(100vw,160dvh)] max-w-none bg-[#5CC8E8]",
          )}
        >
          <image href="/maps/base.svg" width={fullWidth} height={fullHeight} />
          {regions
            .filter(({ state }) => isFogged(state))
            .map(({ id }) => (
              <image
                key={id}
                href={`/maps/fog-${id}.svg`}
                width={fullWidth}
                height={fullHeight}
              />
            ))}
          {focusRegion !== null ? (
            <>
              <image
                href={`/maps/decorations-${focusRegion.id}.svg`}
                width={fullWidth}
                height={fullHeight}
              />
              <image
                href={`/maps/places-${focusRegion.id}.svg`}
                width={fullWidth}
                height={fullHeight}
              />
            </>
          ) : null}
          <MapWords />
          {places
            .filter(
              ({ regionId }) =>
                regionId !== focusRegionId && openRegionIds.has(regionId),
            )
            .map((place) => (
              <PlaceDot key={place.id} place={place} />
            ))}
          {overviewRegions.map((region) => {
            const geometry = regionGeometry(region.id);
            return geometry === undefined ? null : (
              <RegionArea
                key={region.id}
                region={region}
                geometry={geometry}
                scale={nameScale}
                onActivate={() =>
                  activate(
                    region.href,
                    isOpenState(region.state),
                    `Regija ${region.name} još nije otvorena.`,
                  )
                }
              />
            );
          })}
          {focusRegion !== null ? (
            // The zoomed region's places, together, after the regions.
            <g role="group" aria-label="Mjesta">
              {places
                .filter(({ regionId }) => regionId === focusRegionId)
                .map((place) => {
                  const geometry = locationGeometry(place.id);
                  return geometry === undefined ? null : (
                    <Place
                      key={place.id}
                      place={place}
                      geometry={geometry}
                      onActivate={() =>
                        activate(
                          levelCardHref(place),
                          isOpenState(place.state),
                          `Mjesto ${place.name} još nije otvoreno.`,
                        )
                      }
                    />
                  );
                })}
            </g>
          ) : null}
        </svg>
      </div>
      {/* Always mounted, so screen readers are already watching it. Each tap
          inserts a new node, which announces a repeated message again. */}
      <p
        role="status"
        lang={CONTENT_LANG}
        className="pointer-events-none fixed inset-x-0 bottom-44 z-30 flex justify-center px-gutter lg:bottom-32"
      >
        {message !== null ? (
          <span
            key={message.key}
            className="rounded-badge border-2 border-ink bg-surface px-4 py-2 text-lg text-ink shadow-sm"
          >
            {message.text}
          </span>
        ) : null}
      </p>
    </>
  );
}

// The map's own words, which the export had in English: decoration only.
function MapWords() {
  const { sea, neighbours, compassLetter } = MAP_GEOMETRY;
  return (
    <g aria-hidden="true">
      <text
        x={sea.x}
        y={sea.y + sea.height}
        fontSize={sea.height + 4}
        fill="white"
      >
        JADRANSKO MORE
      </text>
      {Object.entries(neighbours).map(([id, box]) => (
        <text
          key={id}
          x={box.x + box.width / 2}
          y={box.y + box.height}
          textAnchor="middle"
          fontSize={box.height + 4}
          fill={NEIGHBOUR}
        >
          {NEIGHBOUR_NAMES[id] ?? id.toUpperCase()}
        </text>
      ))}
      <text
        x={compassLetter.x + compassLetter.width / 2}
        y={compassLetter.y + compassLetter.height}
        textAnchor="middle"
        fontSize={compassLetter.height + 5}
        fill={INK}
      >
        S
      </text>
    </g>
  );
}

// A region's name on the whole map: this size, on two lines when it is longer
// than this many letters (build_map.py places it with the same rule).
const REGION_NAME_SIZE = 34;
const REGION_NAME_WRAP = 12;

function nameLines(name: string): string[] {
  const spaces = [...name].flatMap((letter, index) =>
    letter === " " ? [index] : [],
  );
  if (name.length <= REGION_NAME_WRAP || spaces.length === 0) {
    return [name];
  }
  const split = spaces.reduce((best, index) =>
    Math.abs(index - name.length / 2) < Math.abs(best - name.length / 2)
      ? index
      : best,
  );
  return [name.slice(0, split), name.slice(split + 1)];
}

type RegionAreaProps = {
  region: MapRegion;
  geometry: RegionGeometry;
  /** How much smaller than on the whole map to draw the name. */
  scale: number;
  onActivate: () => void;
};

// A region on the whole map: its outline is what a tap hits, and its name
// (with a lock while it is locked) sits on it.
function RegionArea({ region, geometry, scale, onActivate }: RegionAreaProps) {
  const fontSize = REGION_NAME_SIZE * scale;
  const { outline, name } = geometry;
  const isLocked = region.state === "locked";
  const lines = nameLines(region.name);
  if (region.state === "in-progress") {
    lines.push(`${region.completedCount}/${region.placeCount}`);
  }
  const lineHeight = fontSize * 1.1;
  // The first line's baseline, so the lines sit centred on the point.
  const firstBaseline =
    name.y - ((lines.length - 1) * lineHeight) / 2 + fontSize * 0.35;
  const iconSize = fontSize * 0.8;
  const firstLineWidth = (lines[0] ?? "").length * fontSize * 0.55;

  return (
    <MapLink
      href={region.href}
      isOpen={isOpenState(region.state)}
      label={`${region.name}, ${STATUS_LABELS[region.state]}`}
      onActivate={onActivate}
      focusRing={<path d={outline} />}
    >
      <path d={outline} fill="transparent" />
      <g aria-hidden="true" className="pointer-events-none">
        {isLocked ? (
          <g
            transform={`translate(${name.x - firstLineWidth / 2 - iconSize / 2 - 8 * scale} ${firstBaseline - fontSize * 0.35}) scale(${iconSize / 24})`}
          >
            <circle r={15} fill="white" stroke={INK} strokeWidth={2.5} />
            <LockGlyph />
          </g>
        ) : null}
        <text
          textAnchor="middle"
          fontSize={fontSize}
          fill={INK}
          stroke="white"
          strokeWidth={6 * scale}
          strokeLinejoin="round"
          paintOrder="stroke"
        >
          {lines.map((line, index) => (
            <tspan
              key={index}
              x={name.x}
              y={firstBaseline + index * lineHeight}
            >
              {line}
            </tspan>
          ))}
        </text>
      </g>
    </MapLink>
  );
}

// A town on the whole map: a dot where its building is. Filled while it can
// be opened, hollow while it cannot, and ringed when it is the next place.
// The region around it is what a tap hits.
function PlaceDot({ place }: { place: MapPlace }) {
  const dot = locationGeometry(place.id)?.dot;
  if (dot === undefined) {
    return null;
  }
  return (
    <g aria-hidden="true" className="pointer-events-none">
      {place.isNext ? (
        <circle
          cx={dot.cx}
          cy={dot.cy}
          r={16}
          fill="none"
          stroke={YELLOW}
          strokeWidth={5}
          className="motion-safe:animate-pulse"
        />
      ) : null}
      <circle
        cx={dot.cx}
        cy={dot.cy}
        r={9}
        fill={isOpenState(place.state) ? YELLOW : "white"}
        stroke={INK}
        strokeWidth={3}
      />
    </g>
  );
}

// Fredoka SemiBold's capitals are about 0.68em wide; the pill grows to fit
// the name, so long Montenegrin names never spill out.
function textWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.68;
}

// The size the export draws a name pill and a marker at; zoomed in, the
// build script makes both smaller in the map's units.
const BASE_LABEL_HEIGHT = 28.5;
const BASE_MARKER_RADIUS = 24;

type PlaceProps = {
  place: MapPlace;
  geometry: LocationGeometry;
  onActivate: () => void;
};

// A town in a zoomed-in region: its building (in the art), its marker and
// its name.
function Place({ place, geometry, onActivate }: PlaceProps) {
  const { art, marker, label } = geometry;
  const scale = label.height / BASE_LABEL_HEIGHT;
  const isOpen = isOpenState(place.state);
  const name = place.name.toLocaleUpperCase(CONTENT_LANG);
  const pillWidth = textWidth(name, label.fontSize) + 26 * scale;
  // A tap hits what is drawn for the place: its art, and its marker over its
  // name. Two boxes, not one around both, so neighbours never share a spot.
  const top = marker.cy - marker.r - 4 * scale;
  const stackWidth = Math.max(pillWidth, marker.r * 2);
  const stack = {
    x: label.cx - stackWidth / 2,
    y: top,
    width: stackWidth,
    height: label.cy + label.height / 2 - top,
  };
  const accessibleName = [
    place.name,
    STATUS_LABELS[place.state],
    place.isNext ? NEXT_LABEL : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <MapLink
      href={levelCardHref(place)}
      isOpen={isOpen}
      label={accessibleName}
      onActivate={onActivate}
      focusRing={[art, stack].map((box, index) => (
        <rect
          key={index}
          x={box.x - 4 * scale}
          y={box.y - 4 * scale}
          width={box.width + 8 * scale}
          height={box.height + 8 * scale}
          rx={12 * scale}
        />
      ))}
    >
      <g aria-hidden="true">
        <rect
          x={label.cx - pillWidth / 2}
          y={label.cy - label.height / 2}
          width={pillWidth}
          height={label.height}
          rx={label.height / 2}
          fill="white"
          stroke={INK}
          strokeWidth={2.5 * scale}
        />
        <text
          x={label.cx}
          y={label.cy + label.fontSize * 0.36}
          textAnchor="middle"
          fontSize={label.fontSize}
          fill={INK}
        >
          {name}
        </text>
        <g
          transform={`translate(${marker.cx} ${marker.cy}) scale(${marker.r / BASE_MARKER_RADIUS})`}
        >
          <Marker
            state={place.state}
            order={place.order}
            isNext={place.isNext}
          />
        </g>
      </g>
      {[art, stack].map((box, index) => (
        <rect
          key={index}
          x={box.x}
          y={box.y}
          width={box.width}
          height={box.height}
          rx={12 * scale}
          fill="transparent"
        />
      ))}
    </MapLink>
  );
}

type MarkerProps = {
  state: MapElementState;
  order: number;
  isNext: boolean;
};

// One place's badge, per the handoff's location states, drawn around the
// origin at the export's size. Every state has its own shape or symbol,
// never colour alone.
function Marker({ state, order, isNext }: MarkerProps) {
  const r = BASE_MARKER_RADIUS;
  const disc = {
    completed: GREEN,
    error: CORAL,
    active: YELLOW,
  }[state as string];
  return (
    <g>
      {isNext ? (
        <circle
          r={r + 8}
          fill="none"
          stroke={YELLOW}
          strokeWidth={6}
          className="motion-safe:animate-pulse"
        />
      ) : null}
      <circle
        r={r - 1.2}
        fill={disc ?? "white"}
        stroke={INK}
        strokeWidth={state === "active" ? 4 : 2.4}
        strokeDasharray={state === "loading" ? "6 5" : undefined}
      />
      {state === "in-progress" ? (
        <path
          d={`M 0 ${-r - 5} A ${r + 5} ${r + 5} 0 0 1 ${r + 5} 0`}
          fill="none"
          stroke={YELLOW}
          strokeWidth={6}
          strokeLinecap="round"
        />
      ) : null}
      <MarkerSymbol state={state} order={order} />
    </g>
  );
}

function LockGlyph() {
  return (
    <g fill={INK}>
      <path
        d="M -6 -2 v -4 a 6 6 0 0 1 12 0 v 4"
        fill="none"
        stroke={INK}
        strokeWidth={3}
      />
      <rect x={-9} y={-3} width={18} height={14} rx={3} />
    </g>
  );
}

function MarkerSymbol({
  state,
  order,
}: {
  state: MapElementState;
  order: number;
}) {
  switch (state) {
    case "locked":
      return <LockGlyph />;
    case "completed":
      return (
        <path
          d="M -9 0 l 6 6 l 12 -12"
          fill="none"
          stroke="white"
          strokeWidth={4.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case "loading":
      return (
        <g fill={INK}>
          {[-9, 0, 9].map((dx, index) => (
            <circle
              key={dx}
              cx={dx}
              r={3}
              className="motion-safe:animate-pulse"
              style={{ animationDelay: `${index * 300}ms` }}
            />
          ))}
        </g>
      );
    case "error":
      return (
        <g fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round">
          <path d="M 8 0 a 8 8 0 1 1 -2.3 -5.7" />
          <path d="M 6 -10 v 5 h -5" />
        </g>
      );
    default:
      return (
        <text y={8} textAnchor="middle" fontSize={22} fill={INK}>
          {order}
        </text>
      );
  }
}

type MapLinkProps = {
  href: string;
  isOpen: boolean;
  label: string;
  onActivate: () => void;
  /** The shapes the focus ring outlines. */
  focusRing: ReactNode;
  children: ReactNode;
};

// An SVG link: a real one while open (so a new tab and the address work), and
// a focusable, disabled one while closed. Clicks go through the router, so
// opening a place does not reload the page.
function MapLink({
  href,
  isOpen,
  label,
  onActivate,
  focusRing,
  children,
}: MapLinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.button !== 0
    ) {
      return;
    }
    event.preventDefault();
    onActivate();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLAnchorElement>) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    if (!event.repeat) {
      onActivate();
    }
  }

  return (
    <a
      href={isOpen ? href : undefined}
      // Only a closed place, which has no href, needs the role spelled out.
      role={isOpen ? undefined : "link"}
      tabIndex={0}
      aria-label={label}
      aria-disabled={isOpen ? undefined : true}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="group cursor-pointer outline-none"
    >
      {children}
      <g
        fill="none"
        stroke={FOCUS}
        strokeWidth={5}
        className="hidden group-focus-visible:block"
        aria-hidden="true"
      >
        {focusRing}
      </g>
    </a>
  );
}
