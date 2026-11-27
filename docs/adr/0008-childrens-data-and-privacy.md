# ADR 0008: Children's Data, Consent, Deletion and Retention

- Status: Proposed (Accepted once Product confirms the retention periods below)
- Date: 2026-11-26
- Retention periods confirmed by: _pending (Product)_

## Context

Montelingo stores children's data under a grown-up's account: each player's name, age band and avatar (`learning_profiles`) and their full learning history (`location_progress`, `chapter_progress`, `game_results`, and from ADR 0009 `heart_events`). Today there is no record of consent, no way to delete an account or download its data, and nothing ever removes old data. GDPR requires all of these (Art. 6–8, 12–13, 15, 17, 20 and 5(1)(e)), and Montenegro's personal data protection law follows it closely. Epic #248 proposed answers. This ADR settles them, so the backend tickets (#250–#254) and frontend tickets (#255–#259) build the same thing. The policy's legal text is out of scope (Product, then a lawyer).

Every table that holds a family's data already cascades from `users` (`ON DELETE CASCADE`), directly or through `learning_profiles`. Two facts from the code shape the decisions below:

- `auth_sessions.last_seen_at` is written when a session is created and never updated, and sessions do not slide (`session_refresh_threshold` is unused). Nothing in the database records when an account was last used.
- Database dumps exist in three places: `/opt/montelingo/backups` on the server, its mirror on the Hetzner Storage Box, and Hetzner's whole-disk server backups (kept 7 days), which also contain the local dumps.

## Decisions

### Consent

- **The grown-up account holder consents, at sign-up.** Sign-up already asks for "E-pošta odrasle osobe". The form gets one required checkbox: they confirm they are the parent or legal guardian of the children who will play, and that they have read and accept the privacy policy, which is linked. A child never consents and never sees the checkbox. Consent is the lawful basis (Art. 6(1)(a) with Art. 8) because the grown-up chooses to give us their child's data, and a child cannot.
- **We do not verify parenthood.** We ask for no ID, card payment or second confirmation. We hold little data, all of it typed in by the grown-up and none of it sensitive, so the confirmation is a proportionate "reasonable effort". If we ever collect more (photos, voice, free text from the child), this needs its own decision.
- **We store when and which version.** `users` gets `consent_accepted_at` (timestamptz) and `privacy_policy_version` (text). Sign-up sets both in the same transaction that creates the user. Both are nullable only so existing staging accounts need no invented consent. Every account created after #250 has both set, and the follow-up re-acceptance screen treats null as "not accepted".
- **The sign-up request carries the consent.** `SignUpRequest` gets `parental_consent: true` (any other value is a `422`) and `privacy_policy_version`, the version the page showed. If that version is not the current one, the API answers `409 privacy_policy_outdated` and the web reloads the policy. That way a stale tab can never record consent to text the grown-up did not see.

### Policy version

- **A version is a date, `YYYY-MM-DD`,** the day that text takes effect (for example `2026-12-01`). Dates sort, read well in the policy's footer, and need no numbering scheme.
- **The current version is one constant in the API**, `PRIVACY_POLICY_VERSION` in the users module. The API is the side that records consent, so it is the source of truth. The web reads it from `GET /api/v1/privacy-policy`, which needs no session and returns `{ version }`. The web keeps the policy text in a file named by its version. The sign-up check above makes any drift fail at once, and the E2E test (#260) catches it in CI.
- **A material change is one that changes what we collect, why, who receives it, how long we keep it, or the family's rights.** It gets a new version, and grown-ups accept it again on their next sign-in (the follow-up screen). Wording, typos, layout and contact details are not material. They are edited in place, and the version stays the same.

### Deleting an account

- **Self-service, in the grown-ups area, confirmed with the password.** The grown-ups gate is not security (#174), and a child may be holding a signed-in tablet, so the password is what proves the grown-up is there. Wrong-password attempts share the sign-in account rate limit, so a stolen session cannot be used to guess the password.
- **Immediate and permanent.** In one transaction, the API deletes the `users` row, and the existing cascades remove sessions, reset tokens, players and all progress. It also inserts the user's id into `account_deletions` (below). There is no grace period or undo: GDPR asks for erasure "without undue delay", and a soft-deleted row is still personal data we would have to explain. The screen says plainly that this cannot be undone. The response clears the session cookie.
- **The data leaves every backup within 28 days.** Local dumps are deleted when they are 7 days old (daily) or 20 days old (weekly), and that pruning runs even on a night when the dump fails. Storage Box copies expire through the same nightly `rsync --delete`, and a failed sync fails the script, which cron mails. Hetzner server backups hold a disk image for at most 7 more days, so the worst case is under 21 + 7 = 28 days. This PR keeps 3 weekly dumps instead of 4 to make that true. Storage Box snapshots stay off. A manual Hetzner server snapshot (for example before an upgrade) is deleted within 7 days. When the server is decommissioned, the Storage Box folder is deleted with it. The policy says that deleted data can remain in backups for up to 28 days and is then gone.
- **Dead rows on disk are accepted.** A `DELETE` leaves dead tuples in PostgreSQL's files until autovacuum reclaims and overwrites them, so a whole-disk image can hold fragments for a while. They are not readable through the database or any dump. We accept this, as is common practice, and do not run a manual `VACUUM` after each deletion.
- **A restore must not bring deleted accounts back.** `account_deletions(user_id, deleted_at)` holds only the random id, which identifies no one once the account is gone. It is kept 28 days, then purged nightly. After restoring an older dump, the restore steps take this table from the newest available dump and delete those users again. Accounts deleted after the newest dump cannot be recovered this way, but neither can anything else written in that window.
- **A confirmation email goes to the address,** sent after the transaction commits. It says that the account and every player's data are deleted and that backups clear within 28 days. It names no child. If sending fails, the deletion stands and the failure is logged by recipient domain only, as today.

### Export

- **A JSON file, downloaded from the grown-ups area.** `GET /api/v1/account/export` returns `Content-Disposition: attachment; filename="montelingo-YYYY-MM-DD.json"`. JSON is machine-readable, which is what portability (Art. 20) asks for, and it maps directly onto our tables.
- **Top-level shape:**

```text
{
  "format_version": 1,
  "exported_at": timestamp,
  "account": { "email", "created_at", "consent_accepted_at", "privacy_policy_version" },
  "players": [
    { "id", "name", "age_band", "avatar", "created_at",
      "places":       [ { "location", "started_at", "completed_at" } ],
      "chapters":     [ { "chapter", "lesson_completed_at" } ],
      "game_results": [ { "chapter", "game", "completed_at" } ],
      "hearts":       [ { "earned_at", "source", "chapter", "game" } ] }
  ]
}
```

- Places and chapters are named by their content slug, not by internal ids, so the file makes sense outside our database.
- `format_version` lets the shape grow without breaking anyone who reads old files.
- **Left out:** the password hash, sessions, reset tokens, the active player and `last_selected_at` (device state, not data about the family), rate-limiter keys and anything from `account_deletions`. The export is account data, so it requires the session but not the password again. It uses the API's normal Origin and session checks.

### Retention

One nightly job runs all of these and logs counts only:

| Data                                              | Kept until                                  | Why                                                                                                                                                                   |
| ------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth_sessions`                                   | `expires_at` passes (30 days after sign-in) | An expired session can never be used again.                                                                                                                           |
| `password_reset_tokens`                           | used, or `expires_at` passes (30 minutes)   | Same.                                                                                                                                                                 |
| `account_deletions`                               | 28 days after `deleted_at`                  | No dump older than that still holds the user.                                                                                                                         |
| Inactive accounts                                 | **24 months** without activity              | About two school years. A family that pauses for a summer, or a year, keeps its progress. A family that has left does not keep its child's data with us indefinitely. |
| Warning email before deleting an inactive account | sent **30 days** before                     | Long enough to notice the email and sign in once.                                                                                                                     |

- **"Inactive" is measured by `users.last_active_at`**, a new column. Sign-up and sign-in set it, and any authenticated request moves it forward if it is more than 24 hours old. That costs at most one write per account per day. A child playing on a tablet that stays signed in counts as activity, because the child plays through the grown-up's session. The migration backfills it with the latest `created_at` among the account's sessions, or the account's `created_at` if it has none. `auth_sessions.last_seen_at` is not used for this, because it is never updated.
- **The warning is a step that must have happened.** When `last_active_at` is more than 23 months old, the job sends the warning and sets `users.inactivity_warning_sent_at`. An account is deleted only when it is still inactive **and** the warning was sent at least 30 days earlier, so a failed email delays the deletion and never skips the warning. Any activity clears `inactivity_warning_sent_at`.
- **The deletion is the same as self-service.** It uses the same code path, writes `account_deletions` and sends the confirmation email.
- **Logs are not a data store.** The API never logs email addresses (only the recipient domain) or players' names. Container logs rotate by size (3 × 10 MB per service). The proxy does see client IP addresses for rate limiting, but nothing in the database stores them.

### Data minimisation

- **A player's name can be a nickname.** The profile form says so (wording in #259, along the lines of "Može i nadimak"). The name only appears on screen to greet the child, so it does not need to be their real name.
- **Nothing else about the child is collected:** no birth date (the age band is enough to pick content), no photo, no surname, no school, no location, no free text and no voice. Avatars are chosen from our set, not uploaded. Adding any of these needs a new decision, as does audio that records the child (playing audio to the child is fine).
- **No analytics, trackers or third-party scripts.** The only cookie is the session cookie, which is strictly necessary, so there is no cookie banner. The web stores nothing else on the device.

### Processors

Only two processors see personal data. Both are named in the policy, and each needs a data processing agreement (DPA) signed before launch:

| Processor                | What it does                                                         | What it sees                                                                                                 |
| ------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| SMTP provider (#77)      | Sends password reset, account deleted and inactivity warning emails  | The grown-up's email address and the email text. The emails name no child.                                   |
| Hetzner (EU data centre) | Hosts the server, PostgreSQL, the Storage Box and the server backups | Everything in the database and the dumps, as stored data. Hetzner does not process it for us beyond storage. |

GitHub and the container registry hold code and images only, never user data. The uptime monitor calls `/api/v1/health/*` only.

## API contract

Every route below except `GET /privacy-policy` and `POST /auth/sign-up` requires a session. Every `POST` also passes the Origin check (ADR 0004). Errors use the standard error envelope.

| Method | Path                             | operation_id         | Success                   | Errors                                                    |
| ------ | -------------------------------- | -------------------- | ------------------------- | --------------------------------------------------------- |
| GET    | `/api/v1/privacy-policy`         | `privacy_policy_get` | `200 { version: string }` | none                                                      |
| POST   | `/api/v1/auth/sign-up` (changed) | unchanged            | unchanged                 | adds `409 privacy_policy_outdated`, `422` without consent |
| POST   | `/api/v1/account/delete`         | `account_delete`     | `204`, clears the cookie  | 401, `403 invalid_password`, 403 (Origin), 422, 429       |
| GET    | `/api/v1/account/export`         | `account_export`     | `200` JSON attachment     | 401                                                       |

- `POST /account/delete` takes `{ password: string }`. A wrong password is a `403`, not a `401`, so the web does not mistake it for a signed-out session.

## Consequences

- #250 adds the consent columns, the constant, `GET /privacy-policy` and the sign-up check.
- #251 adds `account_deletions`, the delete route, the confirmation email and the restore step in `docs/deployment.md`.
- #252 builds the export in the shape above.
- #253 runs the nightly job for sessions and reset tokens.
- #254 adds `last_active_at`, `inactivity_warning_sent_at`, the warning and the inactivity deletion.
- #255–#259 build the screens against this contract.
- This PR changes `deploy/backup.sh` to keep 3 weekly dumps instead of 4.
- Before launch, outside the code: Product writes the policy text and a lawyer reviews it, Product confirms the two retention periods (named at the top), DPAs are signed with the SMTP provider and Hetzner, and Storage Box snapshots are confirmed off.
- A restore can lose at most a day of deletions, along with every other write in that window. We accept that rather than run a deletion log outside the database.
