import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import type { GameId } from "@/features/map";

import { type PracticePlace, PRACTICE_ROUNDS } from "../model/practice";
import { PracticeGame } from "./PracticeGame";

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
