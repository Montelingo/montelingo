import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import type { GrownUpsData } from "../model/grown-ups";
import { GrownUpsArea } from "./GrownUpsArea";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

const MIA: GrownUpsData = {
  explorer: { name: "Mia", avatar: "owl" },
  regions: [
    { id: "coast", name: "Obala", completed: 2, total: 6 },
    { id: "central", name: "Centralna Crna Gora", completed: 0, total: 5 },
  ],
  counts: { wordsLearned: 8, stickers: 2, stars: 0, hearts: 0 },
  needsRetry: false,
};

function renderArea(data: Partial<GrownUpsData> = {}) {
  return render(
    <GrownUpsArea
      {...MIA}
      {...data}
      email="sam@family.com"
      signOut={<button type="button">Odjavi se</button>}
    />,
  );
}

describe("GrownUpsArea", () => {
  it("is headed Za roditelje, with Back to Ja and no bottom nav", () => {
    renderArea();

    expect(
      screen.getByRole("heading", { level: 1, name: "Za roditelje" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nazad" })).toHaveAttribute(
      "href",
      "/play/me",
    );
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("shows the child's progress, a row per region with its count and bar", () => {
    const { container } = renderArea();

    const progress = screen.getByRole("region", { name: "Napredak: Mia" });
    expect(
      container.querySelector('img[src*="avatar-owl"]'),
    ).toBeInTheDocument();
    const coast = within(progress).getByRole("group", {
      name: "Obala: 2 od 6 mjesta",
    });
    expect(coast).toHaveTextContent("2/6");
    expect(
      within(progress).getByRole("group", {
        name: "Centralna Crna Gora: 0 od 5 mjesta",
      }),
    ).toHaveTextContent("0/5");
    expect(progress).toHaveTextContent("8 naučenih riječi · 2 naljepnice");
    expect(progress).not.toHaveTextContent(/sedmic|week/i);
  });

  it("marks the rows not loaded, without counts, and offers a retry when progress failed", () => {
    renderArea({
      regions: [{ id: "coast", name: "Obala", completed: null, total: 6 }],
      counts: null,
      needsRetry: true,
    });

    expect(
      screen.getByRole("group", { name: "Obala: nije učitano" }),
    ).toHaveTextContent("–/6");
    expect(screen.queryByText(/naljepnic/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });

  it("shows the account's email and the sign-out control", () => {
    renderArea();

    const account = screen.getByRole("region", { name: "Nalog" });
    expect(account).toHaveTextContent("sam@family.com");
    expect(
      within(account).getByRole("button", { name: "Odjavi se" }),
    ).toBeInTheDocument();
  });

  it("has no Players or Settings cards in part A", () => {
    renderArea();

    expect(screen.getAllByRole("region")).toHaveLength(2);
  });

  it("has no accessibility violations", async () => {
    const { container } = renderArea();

    expect(await axe(container)).toHaveNoViolations();
  });
});
