import { type ApiClient, createApiClient } from "@app/api-client";
import { render, screen } from "@testing-library/react";
import type * as Navigation from "next/navigation";
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

import { getCurrentUser } from "@/features/auth/server";
import type * as grownUps from "@/features/grown-ups";
import { GrownUpsGate } from "@/features/grown-ups";

import { serveApi } from "../../test-api";
import GrownUpsPage, { metadata } from "./page";

// The real loader runs, over a fake API.
const fetchMock = vi.hoisted(() =>
  vi.fn<(request: Request) => Promise<Response>>(),
);
vi.mock("@/lib/api", () => ({
  getApiClient: (): ApiClient =>
    createApiClient({ baseUrl: "http://api.test", fetch: fetchMock }),
}));

// The account, as auth/me sends it; it needs the request's cookies.
vi.mock("@/features/auth/server", () => ({ getCurrentUser: vi.fn() }));

// The real gate. Most tests swap it once for a stand-in that shows the area
// at once, as if the grown-up had passed it.
vi.mock("@/features/grown-ups", async (importOriginal) => {
  const actual = await importOriginal<typeof grownUps>();
  return { ...actual, GrownUpsGate: vi.fn(actual.GrownUpsGate) };
});

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof Navigation>()),
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
  vi.clearAllMocks();
  serveApi(fetchMock);
  vi.mocked(getCurrentUser).mockResolvedValue({
    id: "user-1",
    email: "sam@family.com",
    createdAt: "2026-11-01T10:00:00Z",
  });
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

// The page, with the gate already passed.
async function renderArea() {
  vi.mocked(GrownUpsGate).mockImplementationOnce(({ children }) => (
    <>{children}</>
  ));
  return render(await GrownUpsPage());
}

describe("GrownUpsPage", () => {
  it("is titled", () => {
    expect(metadata.title).toBe("Za roditelje");
  });

  it("shows the gate on load, and not the area behind it", async () => {
    render(await GrownUpsPage());

    expect(
      screen.getByRole("dialog", { name: /^Pritisni i drži broj / }),
    ).toHaveAttribute("open");
    expect(
      screen.queryByRole("heading", { level: 1, name: "Za roditelje" }),
    ).not.toBeInTheDocument();
  });

  it("shows every region with its completed places, and the counts", async () => {
    serveApi(fetchMock, "podgorica-open");

    await renderArea();

    expect(
      screen.getByRole("region", { name: "Napredak: Mia" }),
    ).toHaveTextContent("40 naučenih riječi · 1 naljepnica");
    for (const name of [
      "Obala: 1 od 6 mjesta",
      "Centralna Crna Gora: 0 od 5 mjesta",
      "Sjever i planine: 0 od 6 mjesta",
    ]) {
      expect(screen.getByRole("group", { name })).toBeInTheDocument();
    }
  });

  it("shows the account's email, Odjavi se, and Back to Ja", async () => {
    await renderArea();

    expect(screen.getByRole("region", { name: "Nalog" })).toHaveTextContent(
      "sam@family.com",
    );
    expect(
      screen.getByRole("button", { name: "Odjavi se" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nazad" })).toHaveAttribute(
      "href",
      "/play/me",
    );
  });

  it("links to the privacy policy, behind the gate", async () => {
    await renderArea();

    expect(
      screen.getByRole("link", { name: "Politika privatnosti" }),
    ).toHaveAttribute("href", "/privatnost");
  });

  it("still shows the area when progress fails, with a retry", async () => {
    serveApi(fetchMock, "failed");

    await renderArea();

    expect(
      screen.getByRole("group", { name: "Obala: nije učitano" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });

  it.each([
    ["the account", () => vi.mocked(getCurrentUser).mockResolvedValue(null)],
    ["progress", () => serveApi(fetchMock, "signed-out")],
  ])(
    "sends a grown-up whose session ended to sign in, back here, when %s says so",
    async (_, endSession) => {
      endSession();

      await expect(GrownUpsPage()).rejects.toMatchObject({
        digest: expect.stringContaining(
          encodeURIComponent("/play/me/grown-ups"),
        ) as unknown,
      });
    },
  );

  it("has no accessibility violations, at the gate or past it", async () => {
    const gate = render(await GrownUpsPage());
    expect(await axe(gate.container)).toHaveNoViolations();
    gate.unmount();

    const { container } = await renderArea();
    expect(await axe(container)).toHaveNoViolations();
  });
});
