import { ApiClientError } from "@app/api-client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Profile } from "@/features/profile/edge";

import type { LocationDetail, RegionDetail } from "../model/content";
import type { ProgressResult } from "../model/progress";
import {
  makeChapter,
  makeChapterState,
  makeLocationDetail,
  newAccountProgress,
  NO_COUNTS,
  seedRegionDetail,
  seedRegions,
} from "../test-fixtures";
import {
  assertLocationOpen,
  loadMap,
  loadRegionMap,
  loadRegionName,
  loadRegionScreen,
} from "./screens-api";

const adapters = vi.hoisted(() => ({
  listRegions: vi.fn(),
  getRegion: vi.fn<(regionId: string) => Promise<RegionDetail>>(),
  getLocation: vi.fn<(locationId: string) => Promise<LocationDetail>>(),
  getProgress: vi.fn<() => Promise<ProgressResult>>(),
  getProfile: vi.fn<() => Promise<Profile | null>>(),
}));

vi.mock("./content-api", () => ({
  listRegions: adapters.listRegions,
  getRegion: adapters.getRegion,
  getLocation: adapters.getLocation,
}));
vi.mock("./progress-api", () => ({ getProgress: adapters.getProgress }));
vi.mock("@/features/profile/server", () => ({
  getProfile: adapters.getProfile,
}));

// Like Next.js, notFound() and redirect() throw, so nothing after them runs.
class NotFoundSignal extends Error {}
const navigation = vi.hoisted(() => ({
  notFound: vi.fn(),
  redirect: vi.fn((url: string): never => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));
vi.mock("next/navigation", () => navigation);

// What an adapter throws once the session has ended.
function signedOutError(): ApiClientError {
  return new ApiClientError(401, {
    error: {
      code: "authentication_error",
      message: "Authentication required.",
      request_id: "req-1",
      details: null,
    },
  });
}

// A call that fails only when the test says so, to choose which call of a
// loader fails first.
function pendingCall<Value>() {
  let fail: (error: Error) => void = () => undefined;
  const promise = new Promise<Value>((_resolve, reject) => {
    fail = reject;
  });
  return { promise, fail };
}

beforeEach(() => {
  vi.clearAllMocks();
  navigation.notFound.mockImplementation(() => {
    throw new NotFoundSignal();
  });
  adapters.listRegions.mockResolvedValue(seedRegions());
  adapters.getRegion.mockImplementation((regionId) =>
    Promise.resolve(seedRegionDetail(regionId === "north" ? "north" : "coast")),
  );
  adapters.getLocation.mockResolvedValue(makeLocationDetail());
  adapters.getProgress.mockResolvedValue(newAccountProgress());
  adapters.getProfile.mockResolvedValue(null);
});

describe("loadMap", () => {
  beforeEach(() => {
    adapters.getRegion.mockImplementation((regionId) =>
      Promise.resolve(
        seedRegionDetail(regionId as "coast" | "central" | "north"),
      ),
    );
  });

  it("loads every region with its places, joined with progress, in content order", async () => {
    const { regions, places } = await loadMap();

    expect(adapters.getRegion.mock.calls.map(([id]) => id)).toEqual([
      "coast",
      "central",
      "north",
    ]);
    expect(regions.map(({ id, state }) => [id, state])).toEqual([
      ["coast", "available"],
      ["central", "locked"],
      ["north", "locked"],
    ]);
    expect(places).toHaveLength(17);
    expect(places.find(({ isNext }) => isNext)?.id).toBe("budva");
  });

  it("has the placeholder explorer until the profile is set up", async () => {
    await expect(loadMap()).resolves.toMatchObject({ explorer: null });

    adapters.getProfile.mockResolvedValue({
      name: null,
      ageBand: null,
      avatar: null,
      isComplete: false,
    });
    await expect(loadMap()).resolves.toMatchObject({ explorer: null });
  });

  it("shows the child once the profile is set up", async () => {
    adapters.getProfile.mockResolvedValue({
      name: "Mia",
      ageBand: "5-6",
      avatar: "owl",
      isComplete: true,
    });

    await expect(loadMap()).resolves.toMatchObject({
      explorer: {
        name: "Mia",
        avatar: "owl",
        title: "Istraživač · 5–6 godina",
      },
    });
  });

  it("sends the learner to sign in when only the profile finds the session ended", async () => {
    adapters.getProfile.mockRejectedValue(
      new ApiClientError(401, {
        error: {
          code: "authentication_error",
          message: "Authentication required.",
          request_id: "req-1",
          details: null,
        },
      }),
    );

    await expect(loadMap()).rejects.toThrow("NEXT_REDIRECT /sign-in");
  });

  it("still loads the map when progress failed", async () => {
    adapters.getProgress.mockResolvedValue({ status: "error" });

    const { regions } = await loadMap();

    expect(regions.map(({ state }) => state)).toEqual([
      "error",
      "error",
      "error",
    ]);
  });

  it.each(["listRegions", "getRegion"] as const)(
    "lets a failure of %s reach the error boundary",
    async (adapter) => {
      adapters[adapter].mockRejectedValue(new Error("API unavailable"));

      await expect(loadMap()).rejects.toThrow("API unavailable");
      expect(navigation.redirect).not.toHaveBeenCalled();
    },
  );

  it.each(["listRegions", "getProgress", "getRegion"] as const)(
    "sends the learner to sign in when %s finds the session ended",
    async (adapter) => {
      adapters[adapter].mockRejectedValue(signedOutError());

      await expect(loadMap()).rejects.toThrow("NEXT_REDIRECT");
      // The map is where sign-in returns by default, so there is no ?next=.
      expect(navigation.redirect).toHaveBeenCalledWith("/sign-in");
    },
  );

  it("returns to the screen it was loaded for after sign-in", async () => {
    adapters.getProgress.mockRejectedValue(signedOutError());

    await expect(loadMap("/play/coast")).rejects.toThrow("NEXT_REDIRECT");
    expect(navigation.redirect).toHaveBeenCalledWith(
      "/sign-in?next=%2Fplay%2Fcoast",
    );
  });
});

describe("loadRegionMap", () => {
  beforeEach(() => {
    adapters.getRegion.mockImplementation((regionId) =>
      Promise.resolve(
        seedRegionDetail(regionId as "coast" | "central" | "north"),
      ),
    );
  });

  it("loads the region, gated, with the whole map", async () => {
    const { region, regions, places } = await loadRegionMap("coast");

    expect(region).toEqual({ id: "coast", name: "Obala", state: "available" });
    expect(regions).toHaveLength(3);
    expect(places).toHaveLength(17);
  });

  it("redirects to sign in once when the session has ended", async () => {
    adapters.getProgress.mockRejectedValue(signedOutError());
    adapters.listRegions.mockRejectedValue(signedOutError());

    await expect(loadRegionMap("coast")).rejects.toThrow("NEXT_REDIRECT");
    expect(navigation.redirect).toHaveBeenCalledTimes(1);
    expect(navigation.redirect).toHaveBeenCalledWith(
      "/sign-in?next=%2Fplay%2Fcoast",
    );
  });

  it("is not found for an unknown region, whatever else fails", async () => {
    adapters.getRegion.mockRejectedValue(new NotFoundSignal());
    adapters.getProgress.mockRejectedValue(new Error("API unavailable"));

    await expect(loadRegionMap("atlantis")).rejects.toBeInstanceOf(
      NotFoundSignal,
    );
  });

  it("sends a locked region back to the map, which says why", async () => {
    await expect(loadRegionMap("central")).rejects.toThrow("NEXT_REDIRECT");
    expect(navigation.redirect).toHaveBeenCalledWith(
      "/play?notice=region-locked",
    );
  });
});

describe("loadRegionScreen", () => {
  it("loads the region asked for, joined with progress", async () => {
    const screen = await loadRegionScreen("coast");

    expect(adapters.getRegion).toHaveBeenCalledWith("coast");
    expect(screen.region.state).toBe("available");
    expect(screen.locations).toHaveLength(6);
    expect(screen.locations.filter(({ isNext }) => isNext)).toEqual([
      expect.objectContaining({ id: "budva", state: "available" }),
    ]);
    expect(navigation.redirect).not.toHaveBeenCalled();
  });

  it("sends a locked region back to the map with a notice", async () => {
    await expect(loadRegionScreen("north")).rejects.toThrow("NEXT_REDIRECT");
    expect(navigation.redirect).toHaveBeenCalledWith(
      "/play?notice=region-locked",
    );
  });

  it.each([
    ["progress failed", { status: "error" }],
    [
      "progress does not cover the region",
      {
        status: "ready",
        progress: {
          regions: [],
          locations: [],
          chapters: [],
          counts: NO_COUNTS,
        },
      },
    ],
  ] as const)("still opens the region when %s", async (_case, progress) => {
    adapters.getProgress.mockResolvedValue(progress);

    await expect(loadRegionScreen("north")).resolves.toBeDefined();
    expect(navigation.redirect).not.toHaveBeenCalled();
  });

  it("lets notFound() for an unknown region through", async () => {
    adapters.getRegion.mockRejectedValue(new NotFoundSignal());

    await expect(loadRegionScreen("atlantis")).rejects.toBeInstanceOf(
      NotFoundSignal,
    );
    expect(navigation.redirect).not.toHaveBeenCalled();
  });

  it("lets a content failure reach the error boundary", async () => {
    adapters.getRegion.mockRejectedValue(new Error("API unavailable"));

    await expect(loadRegionScreen("coast")).rejects.toThrow("API unavailable");
    expect(navigation.redirect).not.toHaveBeenCalled();
  });

  it.each(["getRegion", "getProgress"] as const)(
    "sends the learner to sign in, then back to the region, when %s finds the session ended",
    async (adapter) => {
      adapters[adapter].mockRejectedValue(signedOutError());

      await expect(loadRegionScreen("coast")).rejects.toThrow("NEXT_REDIRECT");
      expect(navigation.redirect).toHaveBeenCalledTimes(1);
      expect(navigation.redirect).toHaveBeenCalledWith(
        "/sign-in?next=%2Fplay%2Fcoast",
      );
    },
  );
});

describe("loadRegionName", () => {
  it("returns the region's name, without reading progress", async () => {
    await expect(loadRegionName("coast")).resolves.toBe("Obala");
    expect(adapters.getRegion).toHaveBeenCalledWith("coast");
    expect(adapters.getProgress).not.toHaveBeenCalled();
  });

  it("lets notFound() for an unknown region through", async () => {
    adapters.getRegion.mockRejectedValue(new NotFoundSignal());

    await expect(loadRegionName("atlantis")).rejects.toBeInstanceOf(
      NotFoundSignal,
    );
  });

  it("sends the learner to sign in, then back to the region, when the session ended", async () => {
    adapters.getRegion.mockRejectedValue(signedOutError());

    await expect(loadRegionName("coast")).rejects.toThrow("NEXT_REDIRECT");
    expect(navigation.redirect).toHaveBeenCalledWith(
      "/sign-in?next=%2Fplay%2Fcoast",
    );
  });
});

describe("assertLocationOpen", () => {
  it("returns an open location with its region and both states", async () => {
    await expect(assertLocationOpen("coast", "budva")).resolves.toEqual({
      region: { id: "coast", name: "Obala", state: "available" },
      location: {
        ...makeLocationDetail(),
        state: "available",
        chapters: [
          { ...makeChapter(), chapterState: makeChapterState("budva-beach") },
        ],
      },
    });
    expect(adapters.getRegion).toHaveBeenCalledWith("coast");
    expect(adapters.getLocation).toHaveBeenCalledWith("budva");
    expect(navigation.redirect).not.toHaveBeenCalled();
  });

  it("sends a locked location back to its region with a notice", async () => {
    adapters.getLocation.mockResolvedValue(
      makeLocationDetail({ id: "kotor", name: "Kotor" }),
    );

    await expect(assertLocationOpen("coast", "kotor")).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(navigation.redirect).toHaveBeenCalledWith(
      "/play/coast?notice=location-locked",
    );
  });

  it("sends a location in a locked region back to the map with a notice", async () => {
    adapters.getLocation.mockResolvedValue(
      makeLocationDetail({ id: "durmitor", regionId: "north" }),
    );

    await expect(assertLocationOpen("north", "durmitor")).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(navigation.redirect).toHaveBeenCalledWith(
      "/play?notice=region-locked",
    );
  });

  it("calls notFound() for a location that is not in the region", async () => {
    adapters.getLocation.mockResolvedValue(
      makeLocationDetail({ id: "durmitor", regionId: "north" }),
    );

    await expect(
      assertLocationOpen("coast", "durmitor"),
    ).rejects.toBeInstanceOf(NotFoundSignal);
    expect(navigation.redirect).not.toHaveBeenCalled();
  });

  it.each([
    ["in-progress", "completed"],
    ["completed", "in-progress"],
    ["in-progress", "available"],
  ] as const)(
    "opens a location in a %s region that is %s",
    async (regionState, locationState) => {
      adapters.getProgress.mockResolvedValue({
        status: "ready",
        progress: {
          regions: [{ id: "coast", state: regionState }],
          locations: [{ id: "budva", state: locationState, stars: 0 }],
          chapters: [],
          counts: NO_COUNTS,
        },
      });

      const screen = await assertLocationOpen("coast", "budva");

      expect(screen.region.state).toBe(regionState);
      expect(screen.location.state).toBe(locationState);
      expect(navigation.redirect).not.toHaveBeenCalled();
    },
  );

  // Only the server opens a place (ADR 0005): a state that is not known never
  // shows a place's words. The region's screen says why and offers a retry.
  it.each<[string, ProgressResult]>([
    ["progress failed", { status: "error" }],
    [
      "progress covers neither",
      {
        status: "ready",
        progress: {
          regions: [],
          locations: [],
          chapters: [],
          counts: NO_COUNTS,
        },
      },
    ],
    [
      "progress does not cover the location",
      {
        status: "ready",
        progress: {
          regions: [{ id: "coast", state: "available" }],
          locations: [],
          chapters: [],
          counts: NO_COUNTS,
        },
      },
    ],
    [
      "progress does not cover the region",
      {
        status: "ready",
        progress: {
          regions: [],
          locations: [{ id: "budva", state: "available", stars: 0 }],
          chapters: [],
          counts: NO_COUNTS,
        },
      },
    ],
  ])(
    "sends the learner to the region, with no notice, when %s",
    async (_case, progress) => {
      adapters.getProgress.mockResolvedValue(progress);

      await expect(assertLocationOpen("coast", "budva")).rejects.toThrow(
        "NEXT_REDIRECT",
      );
      expect(navigation.redirect).toHaveBeenCalledTimes(1);
      expect(navigation.redirect).toHaveBeenCalledWith("/play/coast");
    },
  );

  it.each(["getRegion", "getLocation", "getProgress"] as const)(
    "sends the learner to sign in, then back to the location, when %s finds the session ended",
    async (adapter) => {
      adapters[adapter].mockRejectedValue(signedOutError());

      await expect(assertLocationOpen("coast", "budva")).rejects.toThrow(
        "NEXT_REDIRECT",
      );
      expect(navigation.redirect).toHaveBeenCalledTimes(1);
      expect(navigation.redirect).toHaveBeenCalledWith(
        "/sign-in?next=%2Fplay%2Fcoast%2Fbudva",
      );
    },
  );

  it("lets notFound() for an unknown location through", async () => {
    adapters.getLocation.mockRejectedValue(new NotFoundSignal());

    await expect(
      assertLocationOpen("coast", "atlantis"),
    ).rejects.toBeInstanceOf(NotFoundSignal);
    expect(navigation.redirect).not.toHaveBeenCalled();
  });
});

// A loader waits for all its calls, so the outcome never depends on which one
// fails first.
describe("a loader whose calls fail together", () => {
  it.each([
    ["the unknown region fails first", ["getRegion", "getProgress"]],
    ["the ended session fails first", ["getProgress", "getRegion"]],
  ] as const)(
    "sends a signed-out visitor to sign in, not to the region's 404, when %s",
    async (_case, failureOrder) => {
      const calls = {
        getRegion: pendingCall<RegionDetail>(),
        getProgress: pendingCall<ProgressResult>(),
      };
      const errors = {
        getRegion: new NotFoundSignal(),
        getProgress: signedOutError(),
      };
      adapters.getRegion.mockReturnValue(calls.getRegion.promise);
      adapters.getProgress.mockReturnValue(calls.getProgress.promise);

      const loading = loadRegionScreen("atlantis");
      for (const adapter of failureOrder) {
        calls[adapter].fail(errors[adapter]);
      }

      await expect(loading).rejects.toThrow("NEXT_REDIRECT");
      expect(navigation.redirect).toHaveBeenCalledTimes(1);
      expect(navigation.redirect).toHaveBeenCalledWith(
        "/sign-in?next=%2Fplay%2Fatlantis",
      );
    },
  );

  it.each([
    ["the unknown location fails first", ["getLocation", "getProgress"]],
    ["the ended session fails first", ["getProgress", "getLocation"]],
  ] as const)(
    "sends a signed-out visitor to sign in, not to the location's 404, when %s",
    async (_case, failureOrder) => {
      const calls = {
        getLocation: pendingCall<LocationDetail>(),
        getProgress: pendingCall<ProgressResult>(),
      };
      const errors = {
        getLocation: new NotFoundSignal(),
        getProgress: signedOutError(),
      };
      adapters.getLocation.mockReturnValue(calls.getLocation.promise);
      adapters.getProgress.mockReturnValue(calls.getProgress.promise);

      const loading = assertLocationOpen("coast", "atlantis");
      for (const adapter of failureOrder) {
        calls[adapter].fail(errors[adapter]);
      }

      await expect(loading).rejects.toThrow("NEXT_REDIRECT");
      expect(navigation.redirect).toHaveBeenCalledTimes(1);
      expect(navigation.redirect).toHaveBeenCalledWith(
        "/sign-in?next=%2Fplay%2Fcoast%2Fatlantis",
      );
    },
  );

  it.each([
    ["the region fails first", ["getRegion", "getLocation"]],
    ["the location fails first", ["getLocation", "getRegion"]],
  ] as const)(
    "throws the region's failure, the first call's, when %s",
    async (_case, failureOrder) => {
      const calls = {
        getRegion: pendingCall<RegionDetail>(),
        getLocation: pendingCall<LocationDetail>(),
      };
      const errors = {
        getRegion: new Error("API unavailable"),
        getLocation: new NotFoundSignal(),
      };
      adapters.getRegion.mockReturnValue(calls.getRegion.promise);
      adapters.getLocation.mockReturnValue(calls.getLocation.promise);

      const loading = assertLocationOpen("coast", "atlantis");
      for (const adapter of failureOrder) {
        calls[adapter].fail(errors[adapter]);
      }

      await expect(loading).rejects.toBe(errors.getRegion);
      expect(navigation.redirect).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["the region fails first", ["getRegion", "getLocation"]],
    ["the location fails first", ["getLocation", "getRegion"]],
  ] as const)(
    "throws notFound() for an unknown region, the first call, when %s",
    async (_case, failureOrder) => {
      const calls = {
        getRegion: pendingCall<RegionDetail>(),
        getLocation: pendingCall<LocationDetail>(),
      };
      const errors = {
        getRegion: new NotFoundSignal(),
        getLocation: new Error("API unavailable"),
      };
      adapters.getRegion.mockReturnValue(calls.getRegion.promise);
      adapters.getLocation.mockReturnValue(calls.getLocation.promise);

      const loading = assertLocationOpen("atlantis", "kotor");
      for (const adapter of failureOrder) {
        calls[adapter].fail(errors[adapter]);
      }

      await expect(loading).rejects.toBe(errors.getRegion);
      expect(navigation.redirect).not.toHaveBeenCalled();
    },
  );
});
