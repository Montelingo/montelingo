import type { Location, Region, RegionDetail } from "./model/content";
import type {
  LocationPickerLocation,
  RegionPickerRegion,
} from "./model/map-state";
import type { ProgressResult } from "./model/progress";

// Test data for the map feature's tests, mirroring the content seed
// (apps/api/app/modules/content/data/content.json): three regions in content
// order, 6, 5 and 6 locations, and Budva, first on the coast, as the start.
// Imported by tests only.

const SEED_REGIONS = [
  {
    id: "coast",
    name: "Obala",
    locations: [
      ["budva", "Budva"],
      ["kotor", "Kotor"],
      ["ulcinj", "Ulcinj"],
      ["herceg-novi", "Herceg Novi"],
      ["tivat", "Tivat"],
      ["bar", "Bar"],
    ],
  },
  {
    id: "central",
    name: "Centralna Crna Gora",
    locations: [
      ["podgorica", "Podgorica"],
      ["cetinje", "Cetinje"],
      ["niksic", "Nikšić"],
      ["danilovgrad", "Danilovgrad"],
      ["skadar-lake", "Skadarsko jezero"],
    ],
  },
  {
    id: "north",
    name: "Sjever i planine",
    locations: [
      ["durmitor", "Durmitor / Žabljak"],
      ["kolasin", "Kolašin"],
      ["berane", "Berane"],
      ["bijelo-polje", "Bijelo Polje"],
      ["pljevlja", "Pljevlja"],
      ["rozaje", "Rožaje"],
    ],
  },
] as const;

type SeedRegionId = (typeof SEED_REGIONS)[number]["id"];

export function makeRegion(overrides: Partial<Region> = {}): Region {
  return { id: "coast", name: "Obala", locationCount: 6, ...overrides };
}

export function makeLocation(overrides: Partial<Location> = {}): Location {
  return {
    id: "budva",
    name: "Budva",
    regionId: "coast",
    chapterCount: 10,
    wordCount: 100,
    ...overrides,
  };
}

/** The three seed regions, as `listRegions()` returns them. */
export function seedRegions(): Region[] {
  return SEED_REGIONS.map(({ id, name, locations }) =>
    makeRegion({ id, name, locationCount: locations.length }),
  );
}

/** One seed region with its locations, as `getRegion()` returns it. */
export function seedRegionDetail(regionId: SeedRegionId): RegionDetail {
  const region = SEED_REGIONS.find(({ id }) => id === regionId);
  if (region === undefined) {
    throw new Error(`No seed region ${regionId}`);
  }
  return {
    id: region.id,
    name: region.name,
    locations: region.locations.map(([id, name]) =>
      makeLocation({ id, name, regionId: region.id }),
    ),
  };
}

/** A new account's progress: the coast and Budva open, everything else locked. */
export function newAccountProgress(): ProgressResult {
  return {
    status: "ready",
    progress: {
      regions: SEED_REGIONS.map(({ id }) => ({
        id,
        state: id === "coast" ? "available" : "locked",
      })),
      locations: SEED_REGIONS.flatMap(({ locations }) =>
        locations.map(([id]) => ({
          id,
          state: id === "budva" ? "available" : "locked",
        })),
      ),
    },
  };
}

export function makeRegionPickerRegion(
  overrides: Partial<RegionPickerRegion> = {},
): RegionPickerRegion {
  return {
    id: "coast",
    name: "Obala",
    state: "available",
    href: "/play/coast",
    ...overrides,
  };
}

export function makeLocationPickerLocation(
  overrides: Partial<LocationPickerLocation> = {},
): LocationPickerLocation {
  return {
    id: "budva",
    name: "Budva",
    state: "available",
    href: "/play/coast/budva",
    isNext: false,
    ...overrides,
  };
}
