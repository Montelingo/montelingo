import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import type { Player } from "../model/players";
import { PlayersCard } from "./PlayersCard";

const api = vi.hoisted(() => ({
  addPlayer: vi.fn<() => Promise<void>>(),
  saveProfile: vi.fn<(update: unknown) => Promise<void>>(),
}));
vi.mock("../api/profile-browser-api", () => api);

const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/lib/use-navigate", () => ({ useNavigate: () => router }));

const MIA: Player = {
  id: "player-mia",
  name: "Mia",
  ageBand: "5-6",
  avatar: "fox",
  isComplete: true,
  isActive: true,
};
const LEO: Player = {
  id: "player-leo",
  name: "Leo",
  ageBand: "7",
  avatar: "bear",
  isComplete: true,
  isActive: false,
};

function renderCard(players: readonly Player[] = [MIA, LEO]) {
  const user = userEvent.setup();
  const view = render(<PlayersCard players={players} art={null} />);
  return { user, ...view };
}

// Dodaj, then the two steps: Leo the frog, 7 years.
async function addLeo(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Dodaj igrača" }));
  await user.type(screen.getByLabelText("Ime djeteta"), "Leo");
  await user.click(screen.getByRole("radio", { name: "Žaba" }));
  await user.click(screen.getByRole("button", { name: "Dalje" }));
  await user.click(screen.getByRole("radio", { name: /^7/ }));
  await user.click(screen.getByRole("button", { name: "Dalje" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  api.addPlayer.mockResolvedValue(undefined);
  api.saveProfile.mockResolvedValue(undefined);
});

describe("PlayersCard", () => {
  it("shows each player's buddy and name, oldest first, then Dodaj", () => {
    const { container } = renderCard();

    const card = screen.getByRole("region", { name: "Igrači" });
    expect(
      within(card)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Mia", "Leo", "Dodaj"]);
    expect(container.querySelector('img[src*="avatar-fox"]')).not.toBeNull();
    expect(container.querySelector('img[src*="avatar-bear"]')).not.toBeNull();
    expect(
      within(card).getByRole("button", { name: "Dodaj igrača" }),
    ).toHaveAttribute("aria-haspopup", "dialog");
  });

  it("shows the placeholder explorer for a player not set up yet", () => {
    renderCard([
      MIA,
      { ...LEO, name: null, avatar: null, ageBand: null, isComplete: false },
    ]);

    expect(screen.getByText("Istraživač")).toBeInTheDocument();
  });

  it("has no Dodaj once the account has four players", () => {
    renderCard([MIA, LEO, { ...LEO, id: "p3" }, { ...LEO, id: "p4" }]);

    expect(
      screen.queryByRole("button", { name: "Dodaj igrača" }),
    ).not.toBeInTheDocument();
  });

  it("opens the setup steps for the new player, with the name first", async () => {
    const { user } = renderCard();

    await user.click(screen.getByRole("button", { name: "Dodaj igrača" }));

    const dialog = screen.getByRole("dialog", { name: "Dodaj igrača" });
    expect(dialog).toHaveAttribute("open");
    expect(
      within(dialog).getByRole("heading", { level: 1, name: "Ko istražuje?" }),
    ).toHaveFocus();
    expect(within(dialog).getByText("Korak 1 od 2")).toBeInTheDocument();
    expect(api.addPlayer).not.toHaveBeenCalled();
  });

  it("adds the player, sets them up, then closes and loads the area again", async () => {
    const { user } = renderCard();

    await addLeo(user);

    expect(api.addPlayer).toHaveBeenCalledTimes(1);
    expect(api.saveProfile).toHaveBeenCalledWith({
      name: "Leo",
      age_band: "7",
      avatar: "frog",
    });
    expect(api.addPlayer.mock.invocationCallOrder[0]).toBeLessThan(
      api.saveProfile.mock.invocationCallOrder[0] ?? 0,
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading", { name: "Igrači" })).toHaveFocus();
  });

  it("keeps the steps open when saving fails, and a retry only saves the profile", async () => {
    api.saveProfile.mockRejectedValueOnce(new Error("offline"));
    const { user } = renderCard();

    await addLeo(user);

    expect(
      await screen.findByText("Nije sačuvano. Pokušaj ponovo."),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveAttribute("open");

    await user.click(screen.getByRole("button", { name: "Dalje" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(api.addPlayer).toHaveBeenCalledTimes(1);
    expect(api.saveProfile).toHaveBeenCalledTimes(2);
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("tries the add again when it failed", async () => {
    api.addPlayer.mockRejectedValueOnce(new Error("offline"));
    const { user } = renderCard();

    await addLeo(user);
    expect(
      await screen.findByText("Nije sačuvano. Pokušaj ponovo."),
    ).toBeInTheDocument();
    expect(api.saveProfile).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Dalje" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(api.addPlayer).toHaveBeenCalledTimes(2);
    expect(api.saveProfile).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      "Back",
      (user: ReturnType<typeof userEvent.setup>) =>
        user.click(screen.getByRole("button", { name: "Nazad" })),
    ],
    [
      "Escape",
      (user: ReturnType<typeof userEvent.setup>) => user.keyboard("{Escape}"),
    ],
  ])(
    "closes with %s on the first step, adding no one, and puts the focus back on Dodaj",
    async (_, close) => {
      const { user } = renderCard();
      await user.click(screen.getByRole("button", { name: "Dodaj igrača" }));

      await close(user);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(api.addPlayer).not.toHaveBeenCalled();
      expect(router.refresh).not.toHaveBeenCalled();
      expect(
        screen.getByRole("button", { name: "Dodaj igrača" }),
      ).toHaveFocus();
    },
  );

  it("goes back from the age to the name, keeping it", async () => {
    const { user } = renderCard();
    await user.click(screen.getByRole("button", { name: "Dodaj igrača" }));
    await user.type(screen.getByLabelText("Ime djeteta"), "Leo");
    await user.click(screen.getByRole("button", { name: "Dalje" }));

    await user.click(screen.getByRole("button", { name: "Nazad" }));

    expect(screen.getByRole("dialog")).toHaveAttribute("open");
    expect(screen.getByLabelText("Ime djeteta")).toHaveValue("Leo");
  });

  it("loads the area again when closed after the player was added", async () => {
    api.saveProfile.mockRejectedValueOnce(new Error("offline"));
    const { user } = renderCard();
    await addLeo(user);
    await screen.findByText("Nije sačuvano. Pokušaj ponovo.");

    await user.click(screen.getByRole("button", { name: "Nazad" }));
    await user.click(screen.getByRole("button", { name: "Nazad" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("has no accessibility violations, closed or adding", async () => {
    const { user, container } = renderCard();
    expect(await axe(container)).toHaveNoViolations();

    await user.click(screen.getByRole("button", { name: "Dodaj igrača" }));

    expect(await axe(container)).toHaveNoViolations();
  });
});
