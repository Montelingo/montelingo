import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import type { MeData } from "../model/me";
import { MeScreen } from "./MeScreen";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

const MIA: MeData = {
  explorer: { name: "Mia", avatar: "owl", title: "Istraživač · 5–6 godina" },
  counts: { wordsLearned: 40, stickers: 3 },
  needsRetry: false,
  canSwitchPlayer: false,
};

function renderMe(me: Partial<MeData> = {}, stars = 7) {
  return render(<MeScreen {...MIA} {...me} stars={stars} />);
}

describe("MeScreen", () => {
  it("shows Ja as the current tab, with the other tabs still there", () => {
    renderMe();

    const nav = screen.getByRole("navigation", { name: "Glavni meni" });
    const me = within(nav).getByRole("link", { name: "Ja" });
    expect(me).toHaveAttribute("href", "/play/me");
    expect(me).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Mapa" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(within(nav).getByRole("link", { name: "Nagrade" })).toHaveAttribute(
      "href",
      "/play/prizes",
    );
  });

  it("is headed by the child's name, with their title and buddy", () => {
    const { container } = renderMe();

    expect(
      screen.getByRole("heading", { level: 1, name: "Mia" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Istraživač · 5–6 godina")).toBeInTheDocument();
    expect(
      container.querySelector('img[src*="avatar-owl"]'),
    ).toBeInTheDocument();
  });

  it("shows the placeholder explorer, without a title, before setup", () => {
    const { container } = renderMe({
      explorer: { name: "Istraživač", avatar: "fox", title: null },
    });

    expect(
      screen.getByRole("heading", { level: 1, name: "Istraživač" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/godin/)).not.toBeInTheDocument();
    expect(
      container.querySelector('img[src*="avatar-fox"]'),
    ).toBeInTheDocument();
  });

  it("shows the stars, words and stickers, each in its tile", () => {
    renderMe();

    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(
      screen.getByRole("group", { name: "Zvjezdice: 7" }),
    ).toHaveTextContent("7zvjezdice");
    expect(screen.getByRole("group", { name: "Riječi: 40" })).toHaveTextContent(
      "40riječi",
    );
    expect(
      screen.getByRole("group", { name: "Naljepnice: 3" }),
    ).toHaveTextContent("3naljepnice");
  });

  it("shows a new child's counts as 0", () => {
    renderMe({ counts: { wordsLearned: 0, stickers: 0 } }, 0);

    for (const name of ["Zvjezdice: 0", "Riječi: 0", "Naljepnice: 0"]) {
      expect(screen.getByRole("group", { name })).toBeInTheDocument();
    }
  });

  it("links the grown-ups row to the grown-ups area", () => {
    renderMe();

    expect(screen.getByRole("link", { name: "Za roditelje" })).toHaveAttribute(
      "href",
      "/play/me/grown-ups",
    );
  });

  it("does not offer to switch player with no one to switch to", () => {
    renderMe();

    expect(screen.queryByText(/Promijeni igrača/)).not.toBeInTheDocument();
  });

  it("links Switch player to the picker, above the grown-ups row", () => {
    renderMe({ canSwitchPlayer: true });

    const switchPlayer = screen.getByRole("link", { name: "Promijeni igrača" });
    expect(switchPlayer).toHaveAttribute("href", "/play/me/players");
    expect(
      switchPlayer.compareDocumentPosition(
        screen.getByRole("link", { name: "Za roditelje" }),
      ),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("offers a retry, and never a wrong 0, when progress failed", () => {
    renderMe({ counts: null, needsRetry: true });

    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
    for (const name of [
      "Zvjezdice: nije učitano",
      "Riječi: nije učitano",
      "Naljepnice: nije učitano",
    ]) {
      expect(screen.getByRole("group", { name })).toHaveTextContent("–");
    }
  });

  it("does not offer a retry when everything loaded", () => {
    renderMe();

    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = renderMe();

    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no accessibility violations with Switch player", async () => {
    const { container } = renderMe({ canSwitchPlayer: true });

    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no accessibility violations with the retry", async () => {
    const { container } = renderMe({ counts: null, needsRetry: true });

    expect(await axe(container)).toHaveNoViolations();
  });
});
