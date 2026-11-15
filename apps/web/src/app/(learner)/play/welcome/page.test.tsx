import { type ApiClient, createApiClient } from "@app/api-client";
import type * as Navigation from "next/navigation";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { serveApi } from "../test-api";
import WelcomePage, { metadata } from "./page";

// The real loaders run, over a fake API.
const fetchMock = vi.hoisted(() =>
  vi.fn<(request: Request) => Promise<Response>>(),
);
vi.mock("@/lib/api", () => ({
  getApiClient: (): ApiClient =>
    createApiClient({ baseUrl: "http://api.test", fetch: fetchMock }),
}));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof Navigation>()),
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("WelcomePage", () => {
  it("is titled", () => {
    expect(metadata.title).toBe("Ko istražuje?");
  });

  it("starts the setup for a profile that is not set up", async () => {
    serveApi(fetchMock, "new-account", "not-set-up");

    render(await WelcomePage());

    expect(
      screen.getByRole("heading", { level: 1, name: "Ko istražuje?" }),
    ).toBeInTheDocument();
  });

  it("sends a set-up profile to the map", async () => {
    serveApi(fetchMock, "new-account", "set-up");

    await expect(WelcomePage()).rejects.toMatchObject({
      digest: expect.stringContaining(";/play;") as unknown,
    });
  });

  it("sends a learner whose session ended to sign in, back to the setup", async () => {
    serveApi(fetchMock, "signed-out");

    await expect(WelcomePage()).rejects.toMatchObject({
      digest: expect.stringContaining(
        ";/sign-in?next=%2Fplay%2Fwelcome;",
      ) as unknown,
    });
  });
});
