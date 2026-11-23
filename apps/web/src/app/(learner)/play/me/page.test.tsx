import { type ApiClient, createApiClient } from "@app/api-client";
import type * as Navigation from "next/navigation";
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

import { errorResponse, serveApi } from "../test-api";
import MePage, { metadata } from "./page";

// The real loader runs, over a fake API.
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

let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
  vi.clearAllMocks();
  serveApi(fetchMock);
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

async function renderPage() {
  return render(await MePage());
}

describe("MePage", () => {
  it("is titled", () => {
    expect(metadata.title).toBe("Ja");
  });

  it("shows the child, with a new account's counts at 0", async () => {
    await renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "Mia" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Istraživač · 5–6 godina")).toBeInTheDocument();
    for (const name of ["Zvjezdice: 0", "Riječi: 0", "Naljepnice: 0"]) {
      expect(screen.getByRole("group", { name })).toBeInTheDocument();
    }
  });

  it("shows the words and stickers the server counted", async () => {
    serveApi(fetchMock, "podgorica-open");

    await renderPage();

    expect(
      screen.getByRole("group", { name: "Riječi: 40" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Naljepnice: 1" }),
    ).toBeInTheDocument();
  });

  it("shows the placeholder explorer before the profile is set up", async () => {
    serveApi(fetchMock, "new-account", "not-set-up");

    await renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "Istraživač" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
  });

  it("still shows the child when progress fails, with a retry", async () => {
    serveApi(fetchMock, "failed");

    await renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "Mia" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Riječi: nije učitano" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });

  it("shows the placeholder explorer and a retry when the profile fails", async () => {
    // The fake API as usual, except that the profile fails.
    const api = fetchMock.getMockImplementation();
    fetchMock.mockImplementation((request) =>
      new URL(request.url).pathname === "/api/v1/profile" || api === undefined
        ? Promise.resolve(errorResponse(500, "internal_server_error"))
        : api(request),
    );

    await renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "Istraživač" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });

  it("sends a learner whose session ended mid-visit to sign in, back to Ja", async () => {
    serveApi(fetchMock, "signed-out");

    await expect(MePage()).rejects.toMatchObject({
      digest: expect.stringContaining("/sign-in") as unknown,
    });
    await expect(MePage()).rejects.toMatchObject({
      digest: expect.stringContaining(
        encodeURIComponent("/play/me"),
      ) as unknown,
    });
  });

  it("has no accessibility violations", async () => {
    const { container } = await renderPage();

    expect(await axe(container)).toHaveNoViolations();
  });
});
