import { createApiClient } from "@app/api-client";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import type { GameId } from "@/features/map";
import { endNavigation } from "@/lib/navigation-progress";

import { type PracticePlace, PRACTICE_ROUNDS } from "../model/practice";
import { RIGHT_DELAY_MS, SETTLE_DELAY_MS } from "./MatchGame";
import { PracticeGame } from "./PracticeGame";

const fetchMock = vi.hoisted(() =>
  vi.fn<(request: Request) => Promise<Response>>(),
);
vi.mock("@/lib/browser-api", () => ({
  getBrowserApiClient: () =>
    createApiClient({ baseUrl: "http://web.test", fetch: fetchMock }),
}));

const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const PRACTICE_MATCH_URL = "http://web.test/api/v1/practice/match/result";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type Word = { id: string; text: string; imageUrl: string | null };

function word(number: number, text: string, picture = true): Word {
  return {
    id: `word-${number}`,
    text,
    imageUrl: picture
      ? `/media/words/${String(number).padStart(4, "0")}.webp`
      : null,
  };
}

// Two pictures in each place: too few for either place alone (memory needs
// three pairs), enough for both together. "riba" comes twice, played once.
const TWO_PLACES: PracticePlace<Word>[] = [
  {
    words: [word(1, "more"), word(2, "riba"), word(3, "sunce", false)],
  },
  {
    words: [word(101, "kuća"), word(102, "Riba"), word(103, "mačka")],
  },
];

// Fisher–Yates with just under 1 keeps every item where it is.
const NO_SHUFFLE = () => 0.999;

function renderPractice(
  gameId: GameId,
  places: readonly PracticePlace<Word>[] | null = TWO_PLACES,
) {
  return render(
    <PracticeGame
      gameId={gameId}
      places={places}
      learnerName="Mia"
      random={NO_SHUFFLE}
    />,
  );
}

function practicePosts() {
  return fetchMock.mock.calls.filter(
    ([request]) =>
      request.method === "POST" && request.url === PRACTICE_MATCH_URL,
  );
}

/** Advances the timers and lets a save's promise settle. */
async function wait(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** Every round of match solved, by its right word, and "Bravo!" settled. */
async function playMatchToBravo() {
  const game = () => screen.getByRole("group", { name: "Spoji riječ i sliku" });
  while (screen.queryByRole("heading", { name: /^Bravo/ }) === null) {
    // An unshuffled round offers its word first.
    const [right] = within(game()).getAllByRole("button");
    if (right === undefined) {
      throw new Error("no options");
    }
    fireEvent.click(right);
    await wait(RIGHT_DELAY_MS);
  }
  await wait(SETTLE_DELAY_MS);
}

describe("PracticeGame saves every game (ADR 0009)", () => {
  beforeEach(() => {
    // Here, not after each test: unmounting a test's screen refreshes.
    vi.clearAllMocks();
    vi.useFakeTimers();
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse(200, { heart_earned: false })),
    );
  });

  afterEach(() => {
    endNavigation();
    vi.useRealTimers();
  });

  it("records a game once when it ends, and says nothing about hearts without one", async () => {
    renderPractice("match");
    expect(practicePosts()).toHaveLength(0);

    await playMatchToBravo();
    await wait(200);

    expect(practicePosts()).toHaveLength(1);
    expect(screen.queryByText(/src/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Pokušaj ponovo" })).toBeNull();
  });

  it("shows +1 srce on Bravo when the game earned a heart", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse(200, { heart_earned: true })),
    );
    renderPractice("match");

    await playMatchToBravo();
    await wait(200);

    expect(screen.getByText("+1 srce", { selector: "p" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("+1 srce");
  });

  it("records Igraj ponovo's new game again when it ends", async () => {
    renderPractice("match");
    await playMatchToBravo();

    fireEvent.click(screen.getByRole("button", { name: "Igraj ponovo" }));
    await playMatchToBravo();

    expect(practicePosts()).toHaveLength(2);
  });

  it("keeps a failed save on Bravo with a retry, and still lets the child go on", async () => {
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(
        jsonResponse(503, {
          error: {
            code: "service_unavailable",
            message: "down",
            request_id: "req-1",
            details: null,
          },
        }),
      ),
    );
    renderPractice("match");
    await playMatchToBravo();
    await wait(0);

    expect(
      screen.getByText("Ovo još nije sačuvano.", { selector: "p" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Nazad na riječi" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Igraj ponovo" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Pokušaj ponovo" }));
    await wait(200);

    expect(practicePosts()).toHaveLength(2);
    expect(screen.getAllByText("Sačuvano!").length).toBeGreaterThan(0);
  });
});

describe("PracticeGame", () => {
  it("deals memory from every place, each text once", () => {
    renderPractice("memory");

    expect(
      screen.getByRole("heading", { level: 1, name: "Vježbaj: Memory" }),
    ).toBeInTheDocument();
    // more, riba (Budva's), kuća and mačka: four pairs.
    expect(
      screen.getAllByRole("button", { name: /^karta \d+, licem dolje$/ }),
    ).toHaveLength(8);
  });

  it("deals match from every place, each text once", () => {
    renderPractice("match");

    expect(
      screen.getByRole("heading", { level: 1, name: "Vježbaj: Spoji riječi" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("match-dots").children).toHaveLength(4);
  });

  it(`plays match ${PRACTICE_ROUNDS} rounds at most`, () => {
    const many: PracticePlace<Word>[] = [
      {
        words: Array.from({ length: 30 }, (_, i) => word(i + 1, `riječ ${i}`)),
      },
    ];
    renderPractice("match", many);

    expect(screen.getByTestId("match-dots").children).toHaveLength(
      PRACTICE_ROUNDS,
    );
  });

  it.each<GameId>(["memory", "match"])(
    "%s: with too few words, says to learn more, and leads back to Riječi",
    async (gameId) => {
      const { container } = renderPractice(gameId, [
        { words: [word(1, "more"), word(2, "riba")] },
      ]);

      expect(
        screen.getByText("Nauči još riječi pa se vrati!"),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "Nazad na riječi" }),
      ).toHaveAttribute("href", "/play/words");
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(await axe(container)).toHaveNoViolations();
    },
  );

  it("says the game did not load when the words did not, and leads back to Riječi", () => {
    renderPractice("memory", null);

    expect(
      screen.getByText(
        "This game didn’t load. Something went wrong on our side.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Nazad na riječi" }),
    ).toHaveAttribute("href", "/play/words");
  });
});
