import { type ApiClient, createApiClient } from "@app/api-client";
import type * as Navigation from "next/navigation";
import { render, screen, within } from "@testing-library/react";
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
import PrizesPage, { metadata } from "./page";

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
  return render(await PrizesPage());
}

describe("PrizesPage", () => {
  it("is titled", () => {
    expect(metadata.title).toBe("Moje nagrade");
  });

  it("shows a new account's open coast with a sticker per place, none earned, and 0 stars", async () => {
    await renderPage();

    const coast = screen.getByRole("region", { name: "Obala" });
    expect(within(coast).getAllByRole("listitem")).toHaveLength(6);
    expect(
      within(coast).getByRole("group", { name: "Zvjezdice: 0 od 18" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Zvjezdice: 0" }),
    ).toBeInTheDocument();
  });

  it("shows the locked regions with their sticker counts", async () => {
    await renderPage();

    expect(
      within(
        screen.getByRole("region", { name: "Sjever i planine (zaključano)" }),
      ).getByText("6 naljepnica se krije u oblacima"),
    ).toBeInTheDocument();
  });

  it("marks a completed place's sticker as earned", async () => {
    serveApi(fetchMock, "podgorica-open");

    await renderPage();

    expect(
      within(screen.getByRole("region", { name: "Obala" }))
        .getByText("Budva")
        .closest("li"),
    ).toHaveAttribute("data-earned", "true");
  });

  it("still shows the regions when progress fails, with a retry", async () => {
    serveApi(fetchMock, "failed");

    await renderPage();

    expect(screen.getByRole("region", { name: "Obala" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });

  it("sends a learner whose session ended mid-visit to sign in, back to the prizes", async () => {
    serveApi(fetchMock, "signed-out");

    await expect(PrizesPage()).rejects.toMatchObject({
      digest: expect.stringContaining("/sign-in") as unknown,
    });
    await expect(PrizesPage()).rejects.toMatchObject({
      digest: expect.stringContaining(
        encodeURIComponent("/play/prizes"),
      ) as unknown,
    });
  });

  it("lets a failed region list reach the error boundary", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(errorResponse(500, "internal_server_error")),
    );

    await expect(PrizesPage()).rejects.toThrow();
  });

  it("has no accessibility violations", async () => {
    const { container } = await renderPage();

    expect(await axe(container)).toHaveNoViolations();
  });
});
