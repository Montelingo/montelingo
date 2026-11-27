import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import type { MeData } from "../model/me";
import { MeScreen } from "./MeScreen";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

const MIA: MeData = {
  explorer: { name: "Mia", avatar: "owl", title: "Istraživač · 5–6 godina" },
  counts: { wordsLearned: 40, stickers: 3, stars: 7, hearts: 2 },
  needsRetry: false,
};

function renderMe(me: Partial<MeData> = {}) {
  return render(<MeScreen {...MIA} {...me} />);
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

  it("shows the stars, hearts, words and stickers, each in its tile", () => {
    renderMe();

    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(
      screen.getByRole("group", { name: "Zvjezdice: 7" }),
    ).toHaveTextContent("7zvjezdice");
    expect(screen.getByRole("group", { name: "Srca: 2" })).toHaveTextContent(
      "2srca",
    );
    expect(screen.getByRole("group", { name: "Riječi: 40" })).toHaveTextContent(
      "40riječi",
    );
    expect(
      screen.getByRole("group", { name: "Naljepnice: 3" }),
    ).toHaveTextContent("3naljepnice");
  });

  it("shows a new child's counts as 0", () => {
    renderMe({
      counts: { wordsLearned: 0, stickers: 0, stars: 0, hearts: 0 },
    });

    for (const name of [
      "Zvjezdice: 0",
      "Srca: 0",
      "Riječi: 0",
      "Naljepnice: 0",
    ]) {
      expect(screen.getByRole("group", { name })).toBeInTheDocument();
    }
  });

  it("opens the grown-ups gate over the screen from the grown-ups row", async () => {
    const user = userEvent.setup();
    renderMe();

    await user.click(screen.getByRole("button", { name: "Za roditelje" }));

    expect(
      screen.getByRole("dialog", { name: /^Pritisni i drži broj / }),
    ).toHaveAttribute("open");
    expect(
      screen.getByRole("heading", { level: 1, name: "Mia" }),
    ).toBeInTheDocument();
  });

  it("does not offer to switch player", () => {
    renderMe();

    expect(screen.queryByText(/Promijeni igrača/)).not.toBeInTheDocument();
  });

  it("offers a retry, and never a wrong 0, when progress failed", () => {
    renderMe({ counts: null, needsRetry: true });

    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
    for (const name of [
      "Zvjezdice: nije učitano",
      "Srca: nije učitano",
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

  it("has no accessibility violations with the retry", async () => {
    const { container } = renderMe({ counts: null, needsRetry: true });

    expect(await axe(container)).toHaveNoViolations();
  });
});
