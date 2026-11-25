import { type ApiClient, createApiClient } from "@app/api-client";
import { render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest";
import { axe } from "vitest-axe";

import { errorResponse, serveApi } from "../../test-api";
import PlayersPage, { metadata } from "./page";

// The real loader runs, over a fake API.
const fetchMock = vi.hoisted(() =>
  vi.fn<(request: Request) => Promise<Response>>(),
);
vi.mock("@/lib/api", () => ({
  getApiClient: (): ApiClient =>
    createApiClient({ baseUrl: "http://api.test", fetch: fetchMock }),
}));

let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
  vi.clearAllMocks();
  serveApi(fetchMock, "new-account", "set-up", 2);
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

describe("PlayersPage", () => {
  it("is titled", () => {
    expect(metadata.title).toBe("Ko igra?");
  });

  it("lists the account's players, with Back to the Ja tab", async () => {
    render(await PlayersPage());

    expect(
      screen.getByRole("heading", { level: 1, name: "Ko igra?" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button").map((button) => button.textContent),
    ).toEqual(["Miasada igra", "Istraživač"]);
    expect(screen.getByRole("link", { name: "Nazad" })).toHaveAttribute(
      "href",
      "/play/me",
    );
  });

  it("throws to the error boundary when the players cannot be read", async () => {
    fetchMock.mockResolvedValue(errorResponse(500, "internal_server_error"));

    await expect(PlayersPage()).rejects.toThrow("players could not be read");
  });

  it("sends a learner whose session ended to sign in, back to the picker", async () => {
    serveApi(fetchMock, "signed-out");

    await expect(PlayersPage()).rejects.toMatchObject({
      digest: expect.stringContaining(
        `/sign-in?next=${encodeURIComponent("/play/me/players")}`,
      ) as unknown,
    });
  });

  it("has no accessibility violations", async () => {
    const { container } = render(await PlayersPage());

    expect(await axe(container)).toHaveNoViolations();
  });
});
