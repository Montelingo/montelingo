# ADR 0006: Lessons and Games

- Status: Accepted
- Date: 2026-11-15

## Context

Phase 1 (ADR 0005, epic #70) shows the map, each place's word groups and which places an account may open. Phase 2 (epic #120) turns a place into something a child does: first a lesson that shows the words, then games that practise them. Backend and frontend tickets build on the same data model and API at the same time, so both are frozen here, as #58 did for phase 1.

Word images exist for Budva (#127). Audio does not exist yet, so nothing in this phase may depend on sound.

## Decisions

- **The chapter is the unit.** A chapter (one word group of 10 words) has one lesson and its games. A place with two chapters has two lessons, and each chapter's games are practised and unlocked separately.
- **The lesson follows the Doman method.** It shows the chapter's ten pictures one at a time, with nothing written on them. An option (**Slike / Riječi**) switches the lesson to the ten words alone, in large letters. A picture and its word are never on one card and are never shown one after the other, so the child learns to read the written word rather than guess it from the picture. There is no timer and no sound: the grown-up reads the words aloud until audio arrives. The lesson counts as seen when the child reaches the last card in either mode. It can be watched again at any time.
- **Two games, the same for every chapter.** `memory`: cards face down, find the pairs of the same picture. `match`: one picture and three written words, tap the word that goes with it. Game ids are a fixed set in code, not content. Neither game has a timer, a score or a fail state: a wrong pick is simply tried again.
- **The lesson unlocks the games, and the server decides.** As ADR 0005 does for places, one pure domain function, `calculate_chapter_state`, computes a chapter's state, and the frontend never computes a lock. A chapter's `lesson` is `todo` or `done`. Each game is `locked` until the lesson is `done`, then `available`, then `completed` once it has been played to the end. Both games open together.
- **Results are recorded once.** Finishing the lesson or a game is recorded the first time only. Repeating it is allowed and answers `200`, but changes nothing. There is no score to keep, so a replay has nothing to add.
- **Doing anything in a place starts it.** The first lesson or game recorded in a place also creates its `location_progress` row (`started_at`), so the map shows the place as `in-progress`. Completing a place and what opens next are not decided here (#139).
- **Two new tables, in one migration.** `chapter_progress` has one row per started chapter, keyed by (learning profile, chapter), with `lesson_completed_at`. `game_results` has one row per finished game, unique on (learning profile, chapter, game), with a check constraint on the game id and `completed_at`. Both cascade on delete, like `location_progress`. One migration creates both, on top of #117's, so parallel tickets never create competing Alembic heads.
- **Word images are static files.** ADR 0005 expected media tables and storage. For now, images are WebP files in the web app at `apps/web/public/media/words/{number:04}.webp`, named by recording number like the future audio files. `WORD_IMAGES` in the content module lists the words that have one, and the API returns `/media/words/NNNN.webp` for those and `null` for the rest (#127). A test keeps the list and the files in step (#128). Moving to object storage later changes only the URL, not the contract. `audio_url` stays `null`.

## API contract

Path parameters are slugs. Every route requires a session and only reads or writes the current account's learning profile.

| Method | Path                                                   | operation_id               | Success                                  | Errors        |
| ------ | ------------------------------------------------------ | -------------------------- | ---------------------------------------- | ------------- |
| GET    | `/api/v1/progress`                                     | `progress_get`             | `200 ProgressState`, now with `chapters` | 401           |
| POST   | `/api/v1/chapters/{chapter_id}/lesson`                 | `progress_complete_lesson` | `200 ChapterState`                       | 401, 404, 409 |
| POST   | `/api/v1/chapters/{chapter_id}/games/{game_id}/result` | `progress_complete_game`   | `200 ChapterState`                       | 401, 404, 409 |

```text
ChapterState  = { id: Slug, lesson: "todo" | "done", games: GameState[] }
GameState     = { id: "memory" | "match", state: "locked" | "available" | "completed" }
ProgressState = { regions: RegionState[], locations: LocationState[], chapters: ChapterState[] }
```

- `games` is always listed in the same order: `memory`, then `match`.
- `ProgressState.chapters` lists only the chapters of places that are not `locked`. For a new account, that is Budva's two chapters.
- Errors use the standard error envelope:
  - `404 content_not_found` for an unknown chapter or game.
  - `409 chapter_locked` when the chapter's place is `locked`.
  - `409 game_locked` when the game is still `locked` because the lesson is not `done`.

## Deferred

What completes a place and what opens next (#139). Feathers and rewards. Audio and the word card's sound button. A "learned" mark per word. Scores, stars and difficulty. Choosing content or games by age band. More game types. Each gets its own ticket or ADR when it is built.

## Consequences

Backend tickets (#122–#126) and frontend tickets (#129–#137) build against this contract in parallel. The frontend builds the lesson and games against fixtures and wires them to the API last (#136). Because the server owns every lock, a child cannot reach a game by URL before seeing the lesson. Adding a game later means a new game id in code, the check constraint and the domain function. Adding images means adding files and their numbers to `WORD_IMAGES`, with no migration.
