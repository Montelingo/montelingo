import {
  type ApiClient,
  ApiClientError,
  ApiNetworkError,
  createApiClient,
  type Schemas,
} from "@app/api-client";
import type * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchLocation,
  fetchRegion,
  fetchRegions,
  getLocation,
  getRegion,
  listRegions,
} from "./content-api";

const fetchMock = vi.hoisted(() =>
  vi.fn<(request: Request) => Promise<Response>>(),
);

const getApiClientMock = vi.hoisted(() =>
  vi.fn<(options?: { forwardCookies?: boolean }) => ApiClient>(),
);

// Tests load React's non-server build, whose cache() never memoizes. Recording
// what it wraps is enough to check that every adapter is cached.
const cacheMock = vi.hoisted(() =>
  vi.fn(<Fn extends (...args: never[]) => unknown>(fn: Fn) => fn),
);

class NotFoundSignal extends Error {}

const notFoundMock = vi.hoisted(() => vi.fn());

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof React>()),
  cache: cacheMock,
}));

vi.mock("@/lib/api", () => ({ getApiClient: getApiClientMock }));

vi.mock("next/navigation", () => ({ notFound: notFoundMock }));

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(status: number, code: string): Response {
  return jsonResponse(status, {
    error: { code, message: "API message", request_id: "req-1", details: null },
  });
}

function sentRequest(): Request {
  const request = fetchMock.mock.calls[0]?.[0];
  if (request === undefined) {
    throw new Error("fetch was not called");
  }
  return request;
}

function makeLocationSummary(
  overrides: Partial<Schemas["LocationSummary"]> = {},
): Schemas["LocationSummary"] {
  return {
    id: "budva",
    name: "Budva",
    region_id: "coast",
    chapter_count: 2,
    word_count: 20,
    ...overrides,
  };
}

function makeWord(overrides: Partial<Schemas["Word"]> = {}): Schemas["Word"] {
  return {
    id: "8f14e45f-ceea-4e7a-9b1c-3c5d2a6f0b11",
    number: 27,
    text: "more",
    note: "the sea",
    image_url: null,
    audio_url: null,
    ...overrides,
  };
}

function makeLocation(
  overrides: Partial<Schemas["LocationDetail"]> = {},
): Schemas["LocationDetail"] {
  return {
    id: "budva",
    name: "Budva",
    region_id: "coast",
    chapters: [
      { id: "the-sea", title: "The sea", position: 3, words: [makeWord()] },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  getApiClientMock.mockReset();
  getApiClientMock.mockImplementation(() =>
    createApiClient({ baseUrl: "http://api.test", fetch: fetchMock }),
  );
  notFoundMock.mockReset();
  notFoundMock.mockImplementation(() => {
    throw new NotFoundSignal();
  });
});

describe("cached adapters", () => {
  it("wraps every adapter in React cache()", () => {
    expect(cacheMock).toHaveBeenCalledWith(fetchRegions);
    expect(cacheMock).toHaveBeenCalledWith(fetchRegion);
    expect(cacheMock).toHaveBeenCalledWith(fetchLocation);
    expect(listRegions).toBe(fetchRegions);
    expect(getRegion).toBe(fetchRegion);
    expect(getLocation).toBe(fetchLocation);
  });
});

describe("fetchRegions", () => {
  it("asks the API for the regions with the incoming cookies", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        items: [],
        page: { has_more: false, next_cursor: null },
      }),
    );

    await fetchRegions();

    expect(getApiClientMock).toHaveBeenCalledWith({ forwardCookies: true });
    expect(sentRequest().method).toBe("GET");
    expect(sentRequest().url).toBe("http://api.test/api/v1/regions");
  });

  it("returns the regions as domain objects, in API order", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        items: [
          { id: "coast", name: "Coast", location_count: 7 },
          { id: "north", name: "North", location_count: 5 },
        ],
        page: { has_more: false, next_cursor: null },
      }),
    );

    await expect(fetchRegions()).resolves.toEqual([
      { id: "coast", name: "Coast", locationCount: 7 },
      { id: "north", name: "North", locationCount: 5 },
    ]);
  });

  it("throws when the response breaks the contract", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        items: [{ id: "Coast!", name: "Coast", location_count: 7 }],
        page: { has_more: false, next_cursor: null },
      }),
    );

    await expect(fetchRegions()).rejects.toThrow();
  });

  it("throws when the regions do not fit on one page", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        items: [{ id: "coast", name: "Coast", location_count: 7 }],
        page: { has_more: true, next_cursor: "next" },
      }),
    );

    await expect(fetchRegions()).rejects.toThrow(
      "The region list has more than one page.",
    );
  });

  it("throws API errors to the error boundary", async () => {
    fetchMock.mockResolvedValue(errorResponse(500, "internal_server_error"));

    await expect(fetchRegions()).rejects.toBeInstanceOf(ApiClientError);
  });

  it("throws network errors to the error boundary", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    await expect(fetchRegions()).rejects.toBeInstanceOf(ApiNetworkError);
  });
});

describe("fetchRegion", () => {
  it("asks the API for one region with the incoming cookies", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { id: "coast", name: "Coast", locations: [] }),
    );

    await fetchRegion("coast");

    expect(getApiClientMock).toHaveBeenCalledWith({ forwardCookies: true });
    expect(sentRequest().url).toBe("http://api.test/api/v1/regions/coast");
  });

  it("returns the region with its locations as domain objects", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        id: "coast",
        name: "Coast",
        locations: [makeLocationSummary()],
      }),
    );

    await expect(fetchRegion("coast")).resolves.toEqual({
      id: "coast",
      name: "Coast",
      locations: [
        {
          id: "budva",
          name: "Budva",
          regionId: "coast",
          chapterCount: 2,
          wordCount: 20,
        },
      ],
    });
  });

  it("calls notFound() for an unknown region", async () => {
    fetchMock.mockResolvedValue(errorResponse(404, "content_not_found"));

    await expect(fetchRegion("atlantis")).rejects.toBeInstanceOf(
      NotFoundSignal,
    );
    expect(notFoundMock).toHaveBeenCalledOnce();
  });

  it("throws other API errors to the error boundary", async () => {
    fetchMock.mockResolvedValue(errorResponse(500, "internal_server_error"));

    await expect(fetchRegion("coast")).rejects.toBeInstanceOf(ApiClientError);
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it("throws when the response breaks the contract", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        id: "coast",
        name: "Coast",
        locations: [makeLocationSummary({ word_count: -1 })],
      }),
    );

    await expect(fetchRegion("coast")).rejects.toThrow();
  });
});

describe("fetchLocation", () => {
  it("asks the API for one location with the incoming cookies", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, makeLocation()));

    await fetchLocation("budva");

    expect(getApiClientMock).toHaveBeenCalledWith({ forwardCookies: true });
    expect(sentRequest().url).toBe("http://api.test/api/v1/locations/budva");
  });

  it("returns the location with its chapters and words as domain objects", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, makeLocation()));

    await expect(fetchLocation("budva")).resolves.toEqual({
      id: "budva",
      name: "Budva",
      regionId: "coast",
      chapters: [
        {
          id: "the-sea",
          title: "The sea",
          position: 3,
          words: [
            {
              id: "8f14e45f-ceea-4e7a-9b1c-3c5d2a6f0b11",
              number: 27,
              text: "more",
              note: "the sea",
              imageUrl: null,
              audioUrl: null,
            },
          ],
        },
      ],
    });
  });

  it("rejects a word id that is not a UUID", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        200,
        makeLocation({
          chapters: [
            {
              id: "the-sea",
              title: "The sea",
              position: 3,
              words: [makeWord({ id: "27" })],
            },
          ],
        }),
      ),
    );

    await expect(fetchLocation("budva")).rejects.toThrow();
  });

  it("calls notFound() for an unknown location", async () => {
    fetchMock.mockResolvedValue(errorResponse(404, "content_not_found"));

    await expect(fetchLocation("atlantis")).rejects.toBeInstanceOf(
      NotFoundSignal,
    );
  });

  it("throws other API errors to the error boundary", async () => {
    fetchMock.mockResolvedValue(errorResponse(401, "authentication_error"));

    await expect(fetchLocation("budva")).rejects.toBeInstanceOf(ApiClientError);
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it("throws when the response breaks the contract", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        200,
        makeLocation({
          chapters: [
            {
              id: "the-sea",
              title: "The sea",
              position: 3,
              words: [makeWord({ number: 0 })],
            },
          ],
        }),
      ),
    );

    await expect(fetchLocation("budva")).rejects.toThrow();
  });
});
