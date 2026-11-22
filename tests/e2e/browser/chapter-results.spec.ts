import { randomUUID } from "node:crypto";

import { expect, type Page, test } from "@playwright/test";

import { setUpProfileAndOpenMap } from "./profile";

const BUDVA = "/play/coast/budva";
const NA_PLAZI = `${BUDVA}/budva-beach`;
// Budva's first chapter, "budva-beach": 10 words.
const NA_PLAZI_WORD_COUNT = 10;

/** Na plaži's lesson and games, on its chapter's screen. */
function naPlazi(page: Page) {
  return page.getByRole("list", { name: "Na plaži lesson and games" });
}

/** Na plaži's card, on Budva's screen. */
function naPlaziCard(page: Page) {
  return page
    .getByRole("list", { name: "Chapters" })
    .getByRole("link", { name: /^Na plaži/ });
}

/** From Budva's screen, opens Na plaži by its card. */
async function openNaPlazi(page: Page) {
  await naPlaziCard(page).click();
  await expect(page).toHaveURL(NA_PLAZI);
}

/**
 * A lesson or game card's name, "<title>, <state>": name computations differ
 * on the space around the comma, so any is matched.
 */
function card(title: string, state: string): RegExp {
  return new RegExp(`^${title}\\s*,\\s*${state}$`);
}

/** The match game's picture's name, its word, or `null` once it is gone. */
function pictureName(page: Page): Promise<string | null> {
  return page.evaluate(
    () =>
      document
        .querySelector('[aria-label="Spoji riječ i sliku"] [role="img"]')
        ?.getAttribute("aria-label") ?? null,
  );
}

/**
 * Follows the "Bravo!" screen's "Nazad na mjesto", retrying while it still
 * ignores presses: its buttons wait a moment after the screen appears.
 */
async function backToPlaceFromBravo(page: Page) {
  const link = page.getByRole("link", { name: "Nazad na mjesto" });
  await expect(async () => {
    if (await link.isVisible()) {
      await link.click();
    }
    await expect(page).toHaveURL(BUDVA, { timeout: 1_000 });
  }).toPass({ timeout: 10_000 });
}

/** The save's response: `kind` is "lesson" or "games/<id>/result". */
function saved(page: Page, kind: string) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith(`/api/v1/chapters/budva-beach/${kind}`),
  );
}

/** A new account with its child's profile, on Na plaži's screen. */
async function newLearnerOnNaPlazi(page: Page) {
  const email = `e2e-results-${randomUUID()}@example.com`;
  const password = `e2e-${randomUUID()}`;
  await page.goto("/sign-up");
  await page.getByLabel("E-pošta odrasle osobe").fill(email);
  await page.getByLabel("Lozinka", { exact: true }).fill(password);
  await page.getByLabel("Potvrdi lozinku").fill(password);
  await page.getByRole("button", { name: "Napravi nalog" }).click();
  // Sign-up hashes the password and signs in: slow when several run at once.
  await expect(page).toHaveURL("/play/welcome", { timeout: 15_000 });
  await setUpProfileAndOpenMap(page);

  await page.goto(BUDVA);
  await openNaPlazi(page);
  await expect(
    naPlazi(page).getByRole("link", { name: card("Lesson", "Start here") }),
  ).toBeVisible();
  await expect(naPlazi(page).getByRole("link", { name: /^Match/ })).toHaveCount(
    0,
  );
}

/** From Na plaži's screen, every card of its lesson, to "Bravo!". */
async function watchLesson(page: Page) {
  await naPlazi(page)
    .getByRole("link", { name: /^Lesson/ })
    .click();
  await expect(page).toHaveURL(`${BUDVA}/budva-beach/lesson`);

  const lessonSaved = saved(page, "lesson");
  const next = page.getByRole("button", { name: "Dalje" });
  for (let card = 0; card < NA_PLAZI_WORD_COUNT; card += 1) {
    await next.click();
  }
  await expect(page.getByRole("heading", { name: "Bravo!" })).toBeVisible();
  expect((await lessonSaved).status()).toBe(200);
  await expect(page.getByText("Ovo još nije sačuvano.")).toHaveCount(0);
}

/** From Na plaži's screen, every round of its match game, to "Bravo!". */
async function playMatch(page: Page) {
  await naPlazi(page)
    .getByRole("link", { name: /^Match/ })
    .click();
  await expect(page).toHaveURL(`${BUDVA}/budva-beach/match`);

  const gameSaved = saved(page, "games/match/result");
  const game = page.getByRole("group", { name: "Spoji riječ i sliku" });
  const bravo = page.getByRole("heading", { name: /^Bravo/ });
  while (!(await bravo.isVisible())) {
    // The picture's name is its word: tap the option that says it.
    const word = await game.getByRole("img").getAttribute("aria-label");
    if (word === null) {
      throw new Error("the picture has no name");
    }
    await game
      .getByRole("button", { name: new RegExp(`^${word}$`, "i") })
      .click();
    // The next round, or "Bravo!", follows the right word.
    await expect.poll(() => pictureName(page)).not.toBe(word);
  }
  await expect(bravo).toBeVisible();
  expect((await gameSaved).status()).toBe(200);
  await expect(page.getByText("Ovo još nije sačuvano.")).toHaveCount(0);
}

// Finishing the lesson and a game saves them (#136). Each run makes its own
// account, so it starts with nothing done. Sign-up, ten lesson cards and ten
// match rounds take longer than the default 30 s when the stack is cold or
// every worker is busy.
test("the lesson and a game are saved, and the place shows it (#136)", async ({
  page,
}) => {
  test.setTimeout(90_000);

  await test.step("a new learner opens Na plaži", () =>
    newLearnerOnNaPlazi(page));

  // The place's first visit back: the link's navigation fetches it.
  await test.step("watch the lesson and go back by its link", async () => {
    await watchLesson(page);
    await backToPlaceFromBravo(page);
    await expect(naPlaziCard(page)).toContainText("1 of 3 done");
    await openNaPlazi(page);
    await expect(
      naPlazi(page).getByRole("link", { name: card("Lesson", "Done") }),
    ).toBeVisible();
    await expect(
      naPlazi(page).getByRole("link", { name: card("Match", "Ready to play") }),
    ).toBeVisible();
  });

  await test.step("play the match game: it saves", () => playMatch(page));
});

// Back, and the link to a place already visited, show the place from the
// router's cache, which #136 refreshes once the save is in. The place's screen
// ignores that refresh (#225), so either can show the state from before the
// game. Skipped until #225 is fixed.
test.fixme(
  "after a saved game, the place shows its new state (#225)",
  async ({ page }) => {
    test.setTimeout(120_000);

    await newLearnerOnNaPlazi(page);
    await watchLesson(page);
    await backToPlaceFromBravo(page);
    await openNaPlazi(page);
    await playMatch(page);

    await test.step("by Back", async () => {
      await page.goBack();
      await expect(page).toHaveURL(NA_PLAZI);
      await expect(
        naPlazi(page).getByRole("link", { name: card("Match", "Completed") }),
      ).toBeVisible();
    });

    await test.step("by the link, on a later visit", async () => {
      await page.goForward();
      await backToPlaceFromBravo(page);
      await expect(naPlaziCard(page)).toContainText("2 of 3 done");
    });
  },
);
