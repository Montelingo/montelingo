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
import WordsPage, { metadata } from "./page";

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
  return render(await WordsPage());
}

describe("WordsPage", () => {
  it("is titled", () => {
    expect(metadata.title).toBe("Moje riječi");
  });

  it("shows a new account the empty state, with the child's buddy", async () => {
    const { container } = await renderPage();

    expect(
      screen.getByRole("heading", { level: 2, name: "Još nemaš riječi" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Riječi: 0" }),
    ).toBeInTheDocument();
    expect(
      container.querySelector('img[src*="avatar-owl"]'),
    ).toBeInTheDocument();
  });

  it("lists the learned words by place, with the next place", async () => {
    serveApi(fetchMock, "podgorica-open");

    await renderPage();

    expect(screen.getAllByRole("region")).toHaveLength(2);
    expect(screen.getByRole("region", { name: "Budva" })).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Podgorica" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("figure")).toHaveLength(40);
    expect(
      screen.getByRole("group", { name: "Riječi: 40" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Sljedeće mjesto: Podgorica · još 20 riječi"),
    ).toBeInTheDocument();
  });

  it("offers a retry when the words fail", async () => {
    serveApi(fetchMock, "failed");

    await renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "Moje riječi" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Još nemaš riječi")).not.toBeInTheDocument();
  });

  it("still shows the words, with the placeholder buddy, when the profile fails", async () => {
    // The fake API as usual, except that the profile fails.
    const api = fetchMock.getMockImplementation();
    fetchMock.mockImplementation((request) =>
      new URL(request.url).pathname === "/api/v1/profile" || api === undefined
        ? Promise.resolve(errorResponse(500, "internal_server_error"))
        : api(request),
    );

    const { container } = await renderPage();

    expect(
      container.querySelector('img[src*="avatar-fox"]'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
  });

  it("sends a learner whose session ended mid-visit to sign in, back to Riječi", async () => {
    serveApi(fetchMock, "signed-out");

    await expect(WordsPage()).rejects.toMatchObject({
      digest: expect.stringContaining(
        encodeURIComponent("/play/words"),
      ) as unknown,
    });
  });

  it("has no accessibility violations", async () => {
    serveApi(fetchMock, "podgorica-open");
    const { container } = await renderPage();

    expect(await axe(container)).toHaveNoViolations();
  });
});
