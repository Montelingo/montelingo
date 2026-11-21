import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { GameUnavailable, type GameUnavailableProps } from "./GameUnavailable";

const LESSON = "/play/coast/budva/budva-beach/lesson";
const PLACE = "/play/coast/budva";

function renderNotice(reason: GameUnavailableProps["reason"]) {
  return render(
    <GameUnavailable
      heading="Memory: Na plaži"
      reason={reason}
      lessonHref={LESSON}
      placeHref={PLACE}
    />,
  );
}

describe("GameUnavailable", () => {
  it.each<[GameUnavailableProps["reason"], string, string, string]>([
    [
      "locked",
      "First watch the lesson. Then you can play.",
      "Watch the lesson",
      LESSON,
    ],
    [
      "not-loaded",
      "This game didn’t load. Something went wrong on our side.",
      "Back to the place",
      PLACE,
    ],
    [
      "no-pictures",
      "This game’s pictures are coming soon.",
      "Back to the place",
      PLACE,
    ],
  ])(
    "%s: says why, with one way on and nothing else to press",
    async (reason, message, action, href) => {
      const { container } = renderNotice(reason);

      expect(
        screen.getByRole("heading", { level: 1, name: "Memory: Na plaži" }),
      ).toBeInTheDocument();
      expect(screen.getByText(message)).toBeInTheDocument();
      expect(screen.getByRole("link")).toHaveAccessibleName(action);
      expect(screen.getByRole("link")).toHaveAttribute("href", href);
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(await axe(container)).toHaveNoViolations();
    },
  );
});
