import { randomUUID } from "node:crypto";

import { expect, type Page, type Request, test } from "@playwright/test";

import { setUpProfileAndOpenMap } from "./profile";

const BUDVA = "/play/coast/budva";
const NA_PLAZI = `${BUDVA}/budva-beach`;
const MEMORY_URL = `${NA_PLAZI}/memory`;
// Budva's first chapter, "budva-beach": 10 words.
const NA_PLAZI_WORD_COUNT = 10;
// The memory game deals 6 of them, two cards each.
const MEMORY_CARD_COUNT = 12;
// The Riječi tab, and its practice memory game (#234, #235).
const WORDS = "/play/words";
const PRACTICE_MEMORY_URL = `${WORDS}/memory`;

// A memory card's accessible name while it is face down, and the end of its
// name once its pair is found. A turn ends with its cards in either state.
const FACE_DOWN = /^karta \d+, licem dolje$/;
const PAIR_FOUND = /, par pronađen$/;
const TURN_ENDED = new RegExp(`${FACE_DOWN.source}|${PAIR_FOUND.source}`);

// How the path of Heroicons' solid StarIcon starts. The star is hidden from
// screen readers, so only its shape tells it from the other badges' icons.
const STAR_PATH = "M10.788 3.21";

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

/**
 * Every pair of Na plaži's memory game, opened by its URL, to "Bravo!": a full
 * page load, where the server renders the page and the browser hydrates it.
 */
async function playMemory(page: Page) {
  await page.goto(MEMORY_URL);
  const gameSaved = saved(page, "games/memory/result");
  await findAllPairs(page, MEMORY_CARD_COUNT);
  await expectBravoAndSaved(page, gameSaved);
}

/**
 * Every pair of the memory game on screen, until "Bravo!". The deal is
 * random, so it finds the pairs by the cards' accessible names. It goes through
 * the board in order, turning each card and then that card's pair if it has
 * seen it, or else the card after it.
 *
 * It reads a word only from the first card of a turn, which waits face up. The
 * other card can turn back after 1 s, too soon to read reliably. Both cards of
 * a found pair must show the same picture.
 */
async function findAllPairs(page: Page, cardCount: number) {
  const cards = page
    .getByRole("group", { name: "Memorija" })
    .getByRole("button");
  await expect(cards).toHaveCount(cardCount);

  const last = cardCount - 1;
  const seenAt = new Map<string, number>();
  for (let index = 0; index <= last; index += 1) {
    const first = cards.nth(index);
    const name = await first.getAttribute("aria-label");
    if (name !== null && PAIR_FOUND.test(name)) {
      continue;
    }
    await first.click();
    await expect(first).not.toHaveAccessibleName(FACE_DOWN);
    const word = await first.getAttribute("aria-label");
    if (word === null) {
      throw new Error("the card has no name");
    }
    const pairIndex = seenAt.get(word);
    seenAt.set(word, index);
    const otherIndex = pairIndex ?? index + 1;
    await cards.nth(otherIndex).click();
    // Every card before the last is paired by the time the last is turned, so
    // that turn ends the game: the board gives way to "Bravo!".
    if (index === last || otherIndex === last) {
      break;
    }
    // A known pair is found. A guess is found too, or turns back.
    await expect(first).toHaveAccessibleName(
      pairIndex === undefined ? TURN_ENDED : PAIR_FOUND,
    );
    if (PAIR_FOUND.test((await first.getAttribute("aria-label")) ?? "")) {
      await expect(cards.nth(otherIndex).locator("img")).toHaveAttribute(
        "src",
        (await first.locator("img").getAttribute("src")) ?? "",
      );
    }
  }

  await expect(page.getByRole("heading", { name: /^Bravo/ })).toBeVisible();
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

/** Follows the "Bravo!" screen's "Nazad na mjesto" to Budva. */
function backToPlaceFromBravo(page: Page) {
  return backFromBravo(page, "Nazad na mjesto", BUDVA);
}

/**
 * Follows the "Bravo!" screen's way back, named `label`, to `url`, retrying
 * while it still ignores presses: its buttons wait a moment after the screen
 * appears.
 */
async function backFromBravo(page: Page, label: string, url: string) {
  const link = page.getByRole("link", { name: label });
  await expect(async () => {
    if (await link.isVisible()) {
      // Short, so a link that went with the navigation fails this attempt.
      await link.click({ timeout: 1_000 });
    }
    await expect(page).toHaveURL(url, { timeout: 1_000 });
  }).toPass({ timeout: 10_000 });
}

/** The learner's progress, as `GET /progress` answers it. */
async function progress(page: Page): Promise<unknown> {
  const response = await page.request.get("/api/v1/progress");
  expect(response.status()).toBe(200);
  return response.json();
}

type Counts = {
  words_learned: number;
  stickers: number;
  stars: number;
  hearts: number;
};
type Progress = {
  locations: { id: string; state: string; stars: number }[];
  counts: Counts;
};

/** Budva's stars and the account's counts, from `GET /progress` (ADR 0009). */
async function budvaStars(page: Page): Promise<{ budva: number } & Counts> {
  const { locations, counts } = (await progress(page)) as Progress;
  const budva = locations.find(({ id }) => id === "budva");
  if (budva === undefined) {
    throw new Error("progress has no Budva");
  }
  return { budva: budva.stars, ...counts };
}

/**
 * Records a lesson or a game through the API, as the screens do, and says
 * whether it earned a heart. The API wants the page's own Origin (ADR 0004).
 */
async function recordResult(page: Page, path: string): Promise<boolean> {
  const response = await page.request.post(`/api/v1/chapters/${path}`, {
    headers: { Origin: new URL(page.url()).origin },
  });
  expect(response.status(), path).toBe(200);
  const body = (await response.json()) as { heart_earned: boolean };
  return body.heart_earned;
}

// Budva's other chapter (content.json), which the screens above never open.
const LJETO = "budva-summer-clothes";

/** The word count on Riječi's header or the Ja screen, named "Riječi: N". */
function wordCount(page: Page, count: number) {
  return page.getByRole("group", { name: `Riječi: ${count}`, exact: true });
}

/** The save's response: `kind` is "lesson" or "games/<id>/result". */
function saved(page: Page, kind: string) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith(`/api/v1/chapters/budva-beach/${kind}`),
  );
}

/** The "Bravo!" screen, with the result saved. */
async function expectBravoAndSaved(page: Page, save: ReturnType<typeof saved>) {
  await expect(page.getByRole("heading", { name: /^Bravo/ })).toBeVisible();
  expect((await save).status()).toBe(200);
  await expect(page.getByText("Ovo još nije sačuvano.")).toHaveCount(0);
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
  await expectBravoAndSaved(page, lessonSaved);
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
  await expectBravoAndSaved(page, gameSaved);
}

// The lesson opens the games (#138), and the lesson and games save their
// results (#136), which a place already shown picks up (#225). The Riječi tab lists the words the lesson taught, and
// practice plays them, recording only a heart (#236, #276). Then a place's
// stars fill one step at a time, and replays earn hearts up to the daily cap
// (#277, ADR 0009). The issues share this
// test for its account, since sign-ups are limited (README.md). Each run signs
// up a new one, so nothing is done yet. Sign-up, the lesson and three games
// take longer than the default 30 s.
test("the lesson opens the games, both games are saved, Riječi lists and practises the words, and stars and hearts add up (#136, #138, #225, #236, #277)", async ({
  page,
}) => {
  test.setTimeout(180_000);

  await test.step("a new learner opens Na plaži", () =>
    newLearnerOnNaPlazi(page));

  await test.step("a new account has no stars or hearts (#277)", async () => {
    expect(await budvaStars(page)).toMatchObject({
      budva: 0,
      stars: 0,
      hearts: 0,
    });
  });

  await test.step("Riječi has no words yet, and leads to the map", async () => {
    await page.goto(WORDS);
    await expect(
      page.getByRole("heading", { level: 2, name: "Još nemaš riječi" }),
    ).toBeVisible();
    await expect(page.getByRole("group", { name: "Vježbaj" })).toHaveCount(0);

    await page.getByRole("link", { name: "Na mapu" }).click();
    await expect(page).toHaveURL("/play");

    await page.goto(BUDVA);
    await openNaPlazi(page);
  });

  await test.step("the memory game is locked", async () => {
    const memory = naPlazi(page)
      .getByRole("listitem")
      .filter({ hasText: "Memory" });
    await expect(memory).toContainText("First watch the lesson");
    await expect(memory.getByRole("link")).toHaveCount(0);
  });

  await test.step("its URL shows the lock message", async () => {
    await page.goto(MEMORY_URL);
    await expect(
      page.getByText("First watch the lesson. Then you can play."),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Watch the lesson" }),
    ).toHaveAttribute("href", `${NA_PLAZI}/lesson`);
    await expect(page.getByRole("group", { name: "Memorija" })).toHaveCount(0);

    await page.goto(BUDVA);
    await openNaPlazi(page);
  });

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

  await test.step("the lesson opened the memory game", async () => {
    await expect(
      naPlazi(page).getByRole("link", {
        name: card("Memory", "Ready to play"),
      }),
    ).toBeVisible();
  });

  await test.step("Riječi lists Budva's words, counted as on the Ja screen", async () => {
    await page.goto(WORDS);
    const budva = page.getByRole("region", { name: "Budva" });
    await expect(budva.getByRole("figure")).toHaveCount(NA_PLAZI_WORD_COUNT);
    await expect(wordCount(page, NA_PLAZI_WORD_COUNT)).toBeVisible();
    // Budva's other chapters still have words to learn.
    await expect(
      page.getByText(/^Sljedeće mjesto: Budva · još \d+ riječi?$/),
    ).toBeVisible();

    await page.goto("/play/me");
    await expect(wordCount(page, NA_PLAZI_WORD_COUNT)).toBeVisible();
  });

  await test.step("practise memory from Riječi: it records a heart, nothing else (#276)", async () => {
    const before = (await progress(page)) as { counts: { hearts: number } };
    // Any write to the API: practice's one is POST /api/v1/practice/….
    const sent: string[] = [];
    const record = (request: Request) => {
      const { pathname } = new URL(request.url());
      if (
        pathname.startsWith("/api/v1/") &&
        !["GET", "HEAD", "OPTIONS"].includes(request.method())
      ) {
        sent.push(`${request.method()} ${pathname}`);
      }
    };
    page.on("request", record);

    await page.goto(WORDS);
    await page
      .getByRole("group", { name: "Vježbaj" })
      .getByRole("link", { name: "Memory" })
      .click();
    await expect(page).toHaveURL(PRACTICE_MEMORY_URL);
    // Practice deals 6 pairs from every learned word: Na plaži's ten here.
    await findAllPairs(page, MEMORY_CARD_COUNT);
    // A new account is far from the daily cap, so the game earns a heart.
    await expect(
      page.getByText("+1 srce", { exact: true }).first(),
    ).toBeVisible();
    await backFromBravo(page, "Nazad na riječi", WORDS);

    // Back on Riječi, with nothing left to send: a second save would show here.
    await page.waitForLoadState("networkidle");
    // No lock, star or count moves: only the heart (ADR 0009).
    expect(await progress(page)).toEqual({
      ...before,
      counts: { ...before.counts, hearts: before.counts.hearts + 1 },
    });
    page.off("request", record);
    expect(sent).toEqual(["POST /api/v1/practice/memory/result"]);

    await page.goto(BUDVA);
    await openNaPlazi(page);
  });

  await test.step("play the match game: it saves", () => playMatch(page));

  // Back, and a link to a place already visited, show it from the router's
  // cache, which #136 refreshes once the save is in. On Next.js 15.5 that
  // refresh was dropped (#225), so both showed the state from before the game.
  await test.step("by Back, the chapter shows the game completed (#225)", async () => {
    await page.goBack();
    await expect(page).toHaveURL(NA_PLAZI);
    await expect(
      naPlazi(page).getByRole("link", { name: card("Match", "Completed") }),
    ).toBeVisible();
  });

  // Budva was visited after the lesson, so this link reuses the cached place.
  await test.step("by a link to the place visited before, it shows the game too (#225)", async () => {
    await page
      .getByRole("navigation", { name: "Learner" })
      .getByRole("link", { name: "Back" })
      .click();
    await expect(page).toHaveURL(BUDVA);
    await expect(naPlaziCard(page)).toContainText("2 of 3 done");
  });

  await test.step("play the memory game, opened by its URL: it saves", () =>
    playMemory(page));

  // After a full reload, so what shows is the server's state, not the router's.
  await test.step("after a reload, the lesson is done and the game has a star", async () => {
    await backToPlaceFromBravo(page);
    await openNaPlazi(page);
    await page.reload();

    await expect(
      naPlazi(page).getByRole("link", { name: card("Lesson", "Done") }),
    ).toBeVisible();
    const memory = naPlazi(page).getByRole("link", {
      name: card("Memory", "Completed"),
    });
    await expect(memory).toBeVisible();
    await expect(memory.locator(`path[d^="${STAR_PATH}"]`)).toBeVisible();
  });

  await test.step("the map shows Budva in progress", async () => {
    // Obala's map: on the whole country's, a place is a dot with no name.
    await page.goto("/play/coast");
    await expect(
      page
        .getByRole("group", { name: "Mjesta", exact: true })
        .getByRole("link", { name: /^Budva, u toku(,|$)/ }),
    ).toBeVisible();
  });

  // Through the API from here: the screens above already showed each save.
  await test.step("Budva's stars fill one step at a time, and a first time earns no heart (#277)", async () => {
    // Na plaži is done, but a star needs its step in every chapter of the place.
    // Practice earned the account's one heart so far.
    expect(await budvaStars(page)).toMatchObject({
      budva: 0,
      stars: 0,
      hearts: 1,
    });

    const firstTimes = [];
    firstTimes.push(await recordResult(page, `${LJETO}/lesson`));
    expect((await budvaStars(page)).budva).toBe(1);
    firstTimes.push(await recordResult(page, `${LJETO}/games/memory/result`));
    expect((await budvaStars(page)).budva).toBe(2);
    firstTimes.push(await recordResult(page, `${LJETO}/games/match/result`));

    expect(firstTimes).toEqual([false, false, false]);
    expect(await budvaStars(page)).toMatchObject({
      budva: 3,
      stars: 3,
      stickers: 1,
      hearts: 1,
    });
  });

  await test.step("replays earn hearts up to 5 a day, then nothing changes (#277)", async () => {
    const replay = "budva-beach/games/memory/result";
    // A replay earns a heart, and the count goes up by one.
    expect(await recordResult(page, replay)).toBe(true);
    expect((await budvaStars(page)).hearts).toBe(2);

    // Up to the cap: 5 hearts a day, practice's included. A run that crosses
    // midnight in Podgorica would start a new day, and could earn more.
    const earned = [];
    for (let replays = 0; replays < 3; replays += 1) {
      earned.push(await recordResult(page, replay));
    }
    expect(earned).toEqual([true, true, true]);
    const atCap = (await progress(page)) as Progress;
    expect(atCap.counts.hearts).toBe(5);

    // Past the cap: still 200, no heart, and nothing else moves.
    expect(await recordResult(page, replay)).toBe(false);
    expect(await recordResult(page, "budva-beach/lesson")).toBe(false);
    expect(await progress(page)).toEqual(atCap);
  });
});
