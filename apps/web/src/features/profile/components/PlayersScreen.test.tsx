import { ApiClientError } from "@app/api-client";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { signInHref } from "@/features/auth/edge";

import type { Player } from "../model/players";
import { PlayersScreen } from "./PlayersScreen";

const selectPlayer = vi.hoisted(() =>
  vi.fn<(playerId: string) => Promise<void>>(),
);
vi.mock("../api/profile-browser-api", () => ({ selectPlayer }));

const replaceDocument = vi.hoisted(() => vi.fn<(path: string) => void>());
vi.mock("@/lib/navigation", () => ({ replaceDocument }));

const MIA: Player = {
  id: "player-mia",
  name: "Mia",
  ageBand: "5-6",
  avatar: "owl",
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
// Added by a grown-up, but not set up yet.
const NEW_PLAYER: Player = {
  id: "player-new",
  name: null,
  ageBand: null,
  avatar: null,
  isComplete: false,
  isActive: false,
};

function apiError(status: number, code: string): ApiClientError {
  return new ApiClientError(status, {
    error: { code, message: "API message", request_id: "req-1", details: null },
  });
}

function renderPlayers(players: readonly Player[] = [MIA, LEO]) {
  const user = userEvent.setup();
  const view = render(<PlayersScreen players={players} backHref="/play/me" />);
  return { user, ...view };
}

beforeEach(() => {
  vi.clearAllMocks();
  selectPlayer.mockResolvedValue(undefined);
});

describe("PlayersScreen", () => {
  it("asks who is playing, with Back to the Ja tab", () => {
    renderPlayers();

    expect(
      screen.getByRole("heading", { level: 1, name: "Ko igra?" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nazad" })).toHaveAttribute(
      "href",
      "/play/me",
    );
  });

  it("shows each player with their buddy, oldest first, marking who plays", () => {
    const { container } = renderPlayers([MIA, LEO, NEW_PLAYER]);

    expect(
      screen.getAllByRole("button").map((button) => button.textContent),
    ).toEqual(["Miasada igra", "Leo", "Istraživač"]);
    expect(container.querySelector('img[src*="avatar-owl"]')).not.toBeNull();
    expect(container.querySelector('img[src*="avatar-bear"]')).not.toBeNull();
    // The placeholder explorer's fox, for the player not set up yet.
    expect(container.querySelector('img[src*="avatar-fox"]')).not.toBeNull();
  });

  it("makes the chosen player active, then loads the map anew", async () => {
    const { user } = renderPlayers();

    await user.click(screen.getByRole("button", { name: "Leo" }));

    expect(selectPlayer).toHaveBeenCalledWith("player-leo");
    await waitFor(() => {
      expect(replaceDocument).toHaveBeenCalledWith("/play");
    });
  });

  it("sends one choice for a double tap, and waits meanwhile", async () => {
    selectPlayer.mockReturnValue(new Promise(() => {}));
    const { user } = renderPlayers();

    await user.click(screen.getByRole("button", { name: "Leo" }));
    await user.click(screen.getByRole("button", { name: /Mia/ }));

    expect(selectPlayer).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Leo" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("says when the switch failed, and lets the child choose again", async () => {
    selectPlayer.mockRejectedValueOnce(apiError(500, "internal_server_error"));
    const { user } = renderPlayers();

    await user.click(screen.getByRole("button", { name: "Leo" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Promjena nije uspjela. Pokušaj ponovo.",
    );
    expect(replaceDocument).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Leo" }));

    await waitFor(() => {
      expect(replaceDocument).toHaveBeenCalledWith("/play");
    });
    expect(selectPlayer).toHaveBeenCalledTimes(2);
  });

  it("sends a learner whose session ended to sign in, back to the picker", async () => {
    selectPlayer.mockRejectedValueOnce(apiError(401, "authentication_error"));
    const { user } = renderPlayers();

    await user.click(screen.getByRole("button", { name: "Leo" }));

    await waitFor(() => {
      expect(replaceDocument).toHaveBeenCalledWith(
        signInHref("/play/me/players"),
      );
    });
  });

  it("has no accessibility violations", async () => {
    const { container } = renderPlayers([MIA, LEO, NEW_PLAYER]);

    expect(await axe(container)).toHaveNoViolations();
  });
});
