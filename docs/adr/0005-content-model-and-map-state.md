# ADR 0005: Content Model and Map State

- Status: Accepted
- Date: 2026-10-18

## Context

Phase 1 of the map (epic #70) shows the three regions, their locations and each town's word groups, and tells every account which places it may open. Several backend and frontend tickets build on the same data model and API at the same time, so both are frozen up front in #58, as #29 did for authentication.

The specification describes about five words per chapter and 45–60 words in total. The recording list the content is produced from has 30 word groups of 10 words, 300 in total, across 17 locations.

## Decisions

- **The recording list wins.** Content is 30 chapters of 10 words, 300 words, in 3 regions and 17 locations. The specification is corrected to match.
- **Hierarchy.** Region → Location → Chapter → Vocabulary item. A chapter is one word group of the recording list, and its `position` is the recording order (1–30). Towns and natural places (Skadar Lake, Durmitor) are both locations. A location can hold several chapters.
- **Identifiers.** Every content row has a UUID primary key and a unique English kebab-case `slug` (`^[a-z][a-z0-9-]*$`, enforced by a check constraint). The API exposes the slug as `id`, so the final SVG map can use `region-coast` and `location-kotor` without renaming. Words have no slug: their API `id` is the row's UUID, and their recording `number` (1–300) is the identifier that is stable across environments. The number is also the future audio file name (word 27 is `0027.mp3`).
- **Source of truth.** The recording list is committed as `app/modules/content/data/content.json` and validated by `load_content()`. An idempotent seed command (#62) writes it to the database. Content is never edited in the database by hand.
- **Content and state are separate.** The three content endpoints return the same data for every account, so they can be cached. Per-account state comes from one separate `GET /progress` call, shaped as lists of `{id, state}` for regions and locations, matching the SVG map contract.
- **The server decides unlocking.** One pure domain function in the progress module computes every state (#66). The frontend never computes a lock. The states are exactly `locked`, `available`, `in-progress` and `completed`. In phase 1 the starting location (Budva, the only `is_start` row, enforced by a partial unique index) is `available` and everything else is `locked`. Until #66, `GET /progress` returns that starting state from the data file.
- **Progress is stored per location.** `location_progress` has one row per started location (`started_at`, nullable `completed_at`). No row means the location was never started. Nothing writes it in phase 1; the write path arrives with games.
- **Media are placeholders.** Every word has `image_url` and `audio_url` in the contract, and both are `null` in phase 1. Media tables, storage and delivery arrive with the media ticket in phase 2 without a contract change.
- **One learning profile per account.** Progress belongs to a learning profile, not to the login record, enforced by a unique constraint on `user_id`. Deleting an account deletes its profile and progress. The specification creates the profile on email verification. Verification is not built, so the profile is created at sign-up (#64), and the migration creates one for every existing account. This moves to verification when verification is built.
- **Every route needs a session.** Content and progress routes answer `401` without one. Unknown slugs answer `404 content_not_found`.
- **One migration for the whole phase.** `20261018_0003` creates every phase 1 table, so parallel tickets never create competing Alembic heads.

## Deferred

Games and activities, media storage, completing a location and what opens next, feathers, publishing states and content versioning, age phases, and the authoring UI. Each gets its own ADR or ticket when it is built.

## Consequences

The frontend builds against the generated client before the read path exists, and the SVG map later replaces one component without a contract change. Changing the content means changing the data file and re-running the seed, which keeps content reviewed in pull requests. Because word UUIDs differ between environments, anything that must match across environments (audio files, analytics) uses the recording number.
