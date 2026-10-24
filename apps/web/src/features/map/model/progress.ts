import type { Schemas } from "@app/api-client";

import type { MapElementState, ServerMapState } from "./map-state";

type ProgressEntry = { readonly id: string; readonly state: ServerMapState };

/** The account's state for every region and location, as the server decided it. */
export type Progress = {
  readonly regions: readonly ProgressEntry[];
  readonly locations: readonly ProgressEntry[];
};

/**
 * What `getProgress()` resolves to. A failure is a value, not a throw, so the
 * content can still render, with every place in the error state.
 */
export type ProgressResult =
  | { status: "ready"; progress: Progress }
  | { status: "error" };

/** A content item with the state to draw it in. */
export type WithState<Item> = Item & { state: MapElementState };

type Identified = { id: string };

export function toProgress(data: Schemas["ProgressState"]): Progress {
  return {
    regions: data.regions.map(({ id, state }) => ({ id, state })),
    locations: data.locations.map(({ id, state }) => ({ id, state })),
  };
}

/**
 * Gives every region and location its state from progress, keeping content
 * order. Content decides what is shown: a progress entry for an id that is not
 * in the content is ignored, and an item progress has no entry for is
 * `loading`, never `available`, because only the server opens a place
 * (ADR 0005). When progress failed, every item is `error`.
 */
export function joinProgress<
  Region extends Identified,
  Location extends Identified,
>(
  content: { regions: readonly Region[]; locations: readonly Location[] },
  progress: ProgressResult,
): { regions: WithState<Region>[]; locations: WithState<Location>[] } {
  const ready = progress.status === "ready" ? progress.progress : null;
  return {
    regions: attachStates(content.regions, ready?.regions),
    locations: attachStates(content.locations, ready?.locations),
  };
}

// Without entries (progress failed), every item is `error`.
function attachStates<Item extends Identified>(
  items: readonly Item[],
  entries: readonly ProgressEntry[] | undefined,
): WithState<Item>[] {
  if (entries === undefined) {
    return items.map((item) => ({ ...item, state: "error" }));
  }
  const states = new Map(entries.map(({ id, state }) => [id, state]));
  return items.map((item) => ({
    ...item,
    state: states.get(item.id) ?? "loading",
  }));
}

const NEXT_PLACE_STATES: ReadonlySet<MapElementState> = new Set([
  "available",
  "in-progress",
]);

/**
 * The place to go next: the first location, in content order, that is
 * `available` or `in-progress`. `null` when there is none, such as while
 * progress is loading or failed, or once everything is completed.
 */
export function pickNextPlace<Location extends { state: MapElementState }>(
  locations: readonly Location[],
): Location | null {
  return locations.find(({ state }) => NEXT_PLACE_STATES.has(state)) ?? null;
}
