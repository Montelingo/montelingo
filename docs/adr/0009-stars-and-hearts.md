# ADR 0009: Stars and Hearts

- Status: Proposed (Accepted once Product confirms the daily cap below)
- Date: 2026-11-27
- Daily cap confirmed by: _pending (Product)_
- Amended: 2026-11-28 (#294: Vješalo, a practice-only game id)

## Context

The map's top bar, the level card, the Ja tab and the Prizes tab all show stars, and the top bar shows hearts, but the API sends neither, so every counter is `0`. The Bravo screen already gives `stars: 3` when a game completes a place, and the web has `STARS_PER_PLACE = 3`. ADR 0006 rules out scores, timers and fail states ("a wrong pick is simply tried again") and says a replay records nothing. Epic #237 says practice from the Riječi tab records nothing either, and leaves rewarding it to a later decision. Epic #269 proposed answers. This ADR settles them, so the backend tickets (#271–#273) and frontend tickets (#274–#276) build the same thing.

## Decisions

### Stars measure progress

- **A place gives up to 3 stars, one per step.** Star 1: every chapter of the place has its lesson `done`. Star 2: every chapter has `memory` `completed`. Star 3: every chapter has `match` `completed`. Each step is counted on its own. A game needs its lesson, so in practice star 1 always comes first, but stars 2 and 3 can come in either order, and the rule does not depend on the order.
- **A `completed` place always has 3.** A place completed before content gained a new chapter keeps its sticker and its stars. Otherwise the step rule applies. A `locked` place, and a place with no chapters, has 0.
- **Stars are derived, not stored.** One pure domain function, `calculate_location_stars`, computes them from `chapter_progress` and `game_results`, like `calculate_chapter_state`. There is no table and no migration, and places completed before this ships get their stars at once. Because results are never deleted, stars never go down.
- **Stars never depend on mistakes or speed.** Neither game keeps a score (ADR 0006), and a child who needs many tries earns the same stars. A star is something done, not something done well.

### Hearts reward practice

- **A heart is earned by coming back to words already learned.** +1 for each of: a lesson seen again after it is `done`, a chapter game finished again after it is `completed`, and a practice game finished from the Riječi tab. A first completion gives stars, not a heart, so the two never reward the same thing. Repetition is the core of the Doman method, and nothing rewarded it until now.
- **At most 5 hearts a day per player** (`HEARTS_PER_DAY`), counted across all three sources together. The day is the calendar day in `Europe/Podgorica`, where the children are. The cap keeps the counter from becoming something to grind, and keeps a heart worth a little.
- **Past the cap, nothing is said.** The result is accepted and answers `200` as always, with `heart_earned: false`. The child is never told they have run out, because there is nothing to run out of: the next replay is just a replay.
- **Hearts are not lives.** Nothing is lost on a wrong pick, nothing ever locks, and hearts are never spent to play. A lose-and-wait loop would bring back the fail state ADR 0006 rules out, and it is the kind of nudge to keep playing that ADR 0008 keeps out of a children's app. For the same reason there is no streak that resets.
- **The cap cannot be raced.** Adding a heart locks the player's `learning_profiles` row (`SELECT … FOR UPDATE`) before counting the day's hearts, in the same transaction as the result, so two replays at the same moment cannot both pass the count. This is the pattern ADR 0007 uses for the player limit.

### Storing hearts

One row per heart, in `heart_events`:

| Column                | Type           | Notes                                                               |
| --------------------- | -------------- | ------------------------------------------------------------------- |
| `id`                  | uuid           | primary key                                                         |
| `learning_profile_id` | uuid           | FK to `learning_profiles`, `ON DELETE CASCADE`                      |
| `earned_at`           | timestamptz    | the server's clock                                                  |
| `source`              | text           | check: `lesson`, `game` or `practice`                               |
| `chapter_id`          | uuid, nullable | FK to `chapters`, like `game_results`. Set for `lesson` and `game`. |
| `game`                | text, nullable | check: a practice game id (#294). Set for `game` and `practice`.    |

- A check ties `source` to its columns: `lesson` has a chapter and no game, `game` has both, `practice` has a game and no chapter.
- An index on (`learning_profile_id`, `earned_at`) serves both the total and the day's count.
- A row per heart, rather than a counter, keeps the day's cap a plain count and gives the data export something to show.
- Rows are never updated, and are deleted only by the cascade.
- Amended by #294: `game` allows the practice game ids, `memory`, `match` and `spell`, so it is no longer the same check as `game_results.game`, which keeps the chapter games `memory` and `match`. A `game` row still only holds a chapter game: the result route answers `404 content_not_found` for `spell`.

### Replays and practice now record something

- **ADR 0006 is amended.** "Results are recorded once" still holds for state: a replay changes no lesson, game, lock, place or sticker. But it may now add a heart.
- **Practice gets a route.** `POST /api/v1/practice/{game_id}/result` records a finished practice game. It needs at least one learned word, since practice cannot be dealt without one. This amends #237's "Not recorded" row for hearts only: practice still changes no lock, sticker, star or count of words.
- **Practice has its own game ids.** Amended by #294. `{game_id}` is a `PracticeGameId`: the chapter games `memory` and `match`, and the practice-only `spell` (**Vješalo**, ADR 0006). One finished Vješalo game, five words, is one practice heart under the same daily cap, like a finished Memory or Spoji game. `spell` is not in `GAME_IDS`, which lists the chapter games and from which the stars are counted (`STARS_PER_PLACE = 1 + len(GAME_IDS)`), so a place still gives 3 stars.

### Per player

Stars and hearts belong to the learning profile, not the account (ADR 0007). Two children on one account each have their own, and the routes use the session's active player, as every progress route does.

### Spending hearts

Out of scope. Hearts may later buy things for the buddy (avatar items). That needs its own decision, and it will never involve money.

## API contract

Every route requires a session and only reads or writes the active player. Every `POST` also passes the Origin check (ADR 0004). Errors use the standard error envelope.

| Method | Path                                                             | operation_id                 | Success              | Errors                                     |
| ------ | ---------------------------------------------------------------- | ---------------------------- | -------------------- | ------------------------------------------ |
| GET    | `/api/v1/progress` (changed)                                     | unchanged                    | `200 ProgressState`  | unchanged                                  |
| POST   | `/api/v1/chapters/{chapter_id}/lesson` (changed)                 | unchanged                    | `200 ChapterResult`  | unchanged                                  |
| POST   | `/api/v1/chapters/{chapter_id}/games/{game_id}/result` (changed) | unchanged                    | `200 ChapterResult`  | unchanged                                  |
| POST   | `/api/v1/practice/{game_id}/result`                              | `progress_complete_practice` | `200 PracticeResult` | 401, 403, 404, `409 no_learned_words`, 422 |

```text
LocationState  = { id, state, stars: 0..3 }                       // adds stars
ProgressCounts = { words_learned, stickers, stars, hearts }       // adds stars and hearts
ChapterResult  = ChapterState & { heart_earned: boolean }         // the two result routes
PracticeResult = { heart_earned: boolean }
```

- `counts.stars` is the sum of every place's `stars`. `counts.hearts` is the count of the player's `heart_events`.
- `ChapterResult` adds one field to what the result routes returned, so existing callers keep working. `ProgressState.chapters` stays `ChapterState[]`, without `heart_earned`.
- `404 content_not_found` for an unknown practice game id, as for chapters.

## Consequences

- #271 adds `calculate_location_stars`, `LocationState.stars` and `counts.stars`. No migration.
- #272 adds `heart_events`, `HEARTS_PER_DAY`, `ChapterResult` and `counts.hearts`, and the data export (#252) lists the player's hearts as `"hearts": [ { "earned_at", "source", "chapter", "game" } ]`, with the chapter as its slug.
- #273 adds the practice route.
- #295 adds `PracticeGameId` and lets the `heart_events.game` check allow `spell`, in one migration. `game_results` and `GAME_IDS` are unchanged.
- #274–#276 show them. The web reads stars and hearts and never computes them (ADR 0005). It shows "+1 srce" on the Bravo screen only when `heart_earned` is `true`.
- ADR 0006 is amended, and its **Deferred** list drops stars. ADR 0008's data table lists `heart_events`.
- A child who plays a lot on one day and stops at 5 hearts sees no difference in the game, only in the counter. We accept that the cap is invisible.
