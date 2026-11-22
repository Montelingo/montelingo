# ADR 0007: More Than One Player per Account

- Status: Accepted
- Date: 2026-11-22

## Context

ADR 0005 gives an account exactly one learning profile, enforced by `uq_learning_profiles_user_id`, and every progress route (`/progress`, `/chapters/…`, `/profile`) means "the account's one child". The Ja tab design (epic #174, part B) has **Switch player** and a **Players** card with **Add player**, so a family can share one grown-up account. Backend (#182) and frontend (#183, #184) tickets build on the same model and API at the same time, so both are frozen here.

## Decisions

- **A player is a learning profile.** The API and the screens say "player". The table stays `learning_profiles` and its id is the player's id. Renaming it would touch every progress foreign key and migration for no change in behaviour.
- **At most 4 players per account.** That covers nearly every family and keeps the Players card to one short list. The limit is a constant in the players service, not a database constraint, so raising it later needs no migration. Adding a player locks the account's `users` row first, so two requests at the same moment cannot both pass the count.
- **The active player belongs to the session.** `auth_sessions` gets `active_learning_profile_id`, a nullable foreign key to `learning_profiles` with `ON DELETE SET NULL`. Two devices signed in to the same account can each play as a different child, and a choice on one tablet never changes another. We rejected:
  - **A column on `users`.** Switching on one device would switch every device, under a child who is still playing.
  - **A separate cookie.** It would need its own signing, expiry and checks. The session is already a server-side row that is looked up on every request, so storing the choice there costs nothing more.
- **A new session starts with the last player chosen.** `learning_profiles` gets `last_selected_at`. Choosing or adding a player sets it. Sign-in sets the new session's active player to the account's player with the latest `last_selected_at`, or the oldest player if none has one. A session whose `active_learning_profile_id` is null (because the player was removed, or the session predates this) is resolved the same way on its next request, and the result is stored.
- **The paths stay the same and mean the active player.** `/progress`, `/chapters/…` and `/profile` keep their paths, request and response shapes. `get_learning_profile` returns the session's active player instead of the account's only one, so the existing client and screens need no change. It always loads the player by both id and `user_id`, so a session can never read or write another account's player, even if a row were wrong.
- **Sign-up still creates the first player.** It creates one empty learning profile, as today (ADR 0005), and the child setup steps (`PUT /profile`) fill it in. A new account therefore always has one player, and the first sign-in makes it active.
- **Adding a player starts the setup again.** `POST /players` creates an empty player and makes it active in the same transaction. The client then runs the existing setup steps, which write to the active player through `PUT /profile`. No second setup endpoint is needed.
- **Removing a player is out of scope.** The design does not show it. When it is built: removing a player deletes their progress (every progress table already cascades from `learning_profiles`), the last player cannot be removed, and sessions that had them active fall back as above through `ON DELETE SET NULL`.
- **One migration.** It drops `uq_learning_profiles_user_id`, adds `learning_profiles.last_selected_at` and `auth_sessions.active_learning_profile_id`, and sets every existing session's active player to its account's one profile. Existing accounts keep their child, and it is their active player.

## API contract

Every route requires a session and works only with the current account's players. Every `POST` also passes the Origin check (ADR 0004).

| Method | Path                                 | operation_id     | Success        | Errors             |
| ------ | ------------------------------------ | ---------------- | -------------- | ------------------ |
| GET    | `/api/v1/players`                    | `players_list`   | `200 Player[]` | 401                |
| POST   | `/api/v1/players`                    | `players_add`    | `201 Player`   | 401, 403, 409      |
| POST   | `/api/v1/players/{player_id}/select` | `players_select` | `200 Player`   | 401, 403, 404, 422 |

```text
Player = { id: UUID, name: string | null, age_band: AgeBand | null, avatar: Avatar | null,
           is_complete: boolean, is_active: boolean }
```

- `Player` is the existing `Profile` plus `id` and `is_active`. Exactly one player in the list has `is_active: true`.
- `GET /players` lists players oldest first, so the order does not change when someone switches.
- `POST /players` takes no body.
- `player_id` is a UUID. A malformed one is a `422`.
- Errors use the standard error envelope:
  - `409 players_limit` when the account already has 4 players.
  - `404 player_not_found` for an unknown player, or a player of another account, so the answer does not tell them apart.
- After `POST /players` or `…/select`, the client refetches `/progress` and `/profile`, because they now answer for a different child.

## Consequences

#182 builds the migration and the three routes, and its tests prove that one player's progress never shows for another, in both directions. #183 and #184 build against this contract with fixtures until #182 merges. Nothing else in the client changes, because every existing route keeps its meaning for the player on screen. Switch player (on the Ja screen) and the Players card (in the grown-ups area) use the same routes. The gate is not security (#174), so the API does not tell them apart: any signed-in session may add or switch players.
