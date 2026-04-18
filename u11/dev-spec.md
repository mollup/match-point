# US11 Dev Spec — Event Day Check-In

Short implementation spec for US11 (see `user-stories2.md` §US11 for the user story and full acceptance criteria). This is deliberately scoped to the diff vs. the already-merged US1/US2 backend + frontend.

## 1. Data Model Delta

Two fields are added to existing types in `src/types.ts`. Both default to `false` so existing in-memory rows stay valid.

| Type | New field | Default | Purpose |
|---|---|---|---|
| `Entrant` | `checkedIn: boolean` | `false` | Set to `true` when an organizer marks the player present; set back to `false` via un-check-in. Read by bracket generation to filter no-shows. |
| `Tournament` | `checkInClosed: boolean` | `false` | Latched once the organizer hits "Close Check-In"; gates bracket generation and rejects further check-in writes. |

No new tables/maps: both fields live inside the existing `entrantsByTournament` and `tournaments` maps in `src/store.ts`.

### New store helpers (`src/store.ts`)
- `setEntrantCheckedIn(tournamentId, entrantUserId, checkedIn) → Entrant | undefined` — flips the flag on a single entrant; returns the updated entrant or `undefined` if the tournament/entrant does not exist.
- `closeCheckIn(tournamentId) → Tournament | undefined` — sets `checkInClosed = true` on the tournament; returns the updated tournament.

`createTournament` must initialize `checkInClosed: false`; `addEntrant` must default `checkedIn` to `false` when the field is missing on the input.

## 2. Endpoints

All four live in `src/routes/tournaments.ts`. All four use the existing `requireAuth` + `requireOrganizer` middleware chain (except where noted).

| Method | Path | Auth | Behavior |
|---|---|---|---|
| `POST` | `/api/tournaments/:id/checkin/:entrantId` | organizer | 404 if tournament/entrant missing; 409 if `checkInClosed`; otherwise sets `checkedIn: true` and returns `200 { entrant }`. |
| `DELETE` | `/api/tournaments/:id/checkin/:entrantId` | organizer | Same errors as above; sets `checkedIn: false`; returns `200 { entrant }`. |
| `POST` | `/api/tournaments/:id/checkin/close` | organizer | 404 if missing; 409 if already closed; sets `checkInClosed: true`; returns `200 { tournament }`. |

Plus two modifications to existing endpoints:

- `POST /api/tournaments/:id/bracket` — returns **409** (`"Check-in must be closed before generating the bracket"`) when `checkInClosed === false` *and* the request body does not include an explicit `players` array (so the US1 tests that pass explicit players continue to work). When `checkInClosed === true` and `players` is omitted, bracket generation filters out entrants where `checkedIn === false`.
- `GET /api/tournaments/:id/entrants` — each entrant in the response includes `checkedIn: boolean`. `GET /api/tournaments/:id` likewise exposes `checkInClosed` on the tournament and `checkedIn` on each embedded entrant.

`:entrantId` in the path is the `userId` of the entrant (consistent with how other code references entrants).

## 3. Frontend Surface

### API client (`frontend/src/api.ts`)
Add three methods and extend the two existing DTOs:

- `checkInEntrant(tournamentId, entrantId) → Promise<{ entrant }>`
- `uncheckInEntrant(tournamentId, entrantId) → Promise<{ entrant }>`
- `closeCheckIn(tournamentId) → Promise<{ tournament }>`
- Extend `TournamentDetail.entrants[]` with `checkedIn: boolean`.
- Extend `TournamentSummary` / `TournamentDetail` with `checkInClosed: boolean`.
- Extend `GetEntrants` return type with `checkedIn: boolean`.

### New page
`frontend/src/pages/TournamentCheckInPage.tsx`, reached at route `/t/:id/checkin` (organizer only). Contents:
- Header: tournament name + running counter `X / Y checked in`.
- Entrant list: one row per registered entrant with a single toggle button ("Check in" ↔ "Undo"). Tapping flips the flag via the new API.
- "Close Check-In" button (disabled until at least one entrant is checked in) → confirm modal ("Once closed, no-shows will be excluded from the bracket") → posts to `/checkin/close`.
- After close: navigate to `/t/:id/bracket` (which will now auto-generate without no-shows on the next organizer-triggered run, i.e. the detail page's existing `Generate bracket` button works).
- States: Loading (entrants fetch), Error (banner on failed API), Empty (no entrants — show "Sign ups required before check-in"), Closed (replace toggle with a read-only `Checked in` / `Did not attend` badge when `checkInClosed` is true).

### Changes to existing pages
- `TournamentDetail.tsx`
  - Organizer view: add a "Check-in" button next to "Generate bracket" that navigates to `/t/:id/checkin`.
  - Entrant list: for entrants where `checkInClosed && !checkedIn`, render a small "Did Not Attend" badge after the display name.
- `App.tsx` — register the new route under `DashboardLayout`.

## 4. Tests

One integration test per machine AC in a new `src/checkin.test.ts`, mirroring the vitest + supertest patterns already in `src/api.test.ts`. Minimum six tests:

1. `POST /checkin/:entrantId` with organizer auth → 200, entrant `checkedIn === true`.
2. `POST /checkin/:entrantId` called by a non-organizer player → 403.
3. `DELETE /checkin/:entrantId` reverses the flag → 200, entrant `checkedIn === false`.
4. `GET /entrants` includes `checkedIn` for every entrant.
5. `POST /bracket` once `checkInClosed` → excludes `checkedIn: false` entrants; called before close → 409.
6. `POST /checkin/close` → 200 + `checkInClosed: true`; a second `POST /checkin/:entrantId` afterwards → 409.

## 5. Human Test Checklist

`u11/HumanTests.md` mirrors the `US2HumanTests.md` format and covers the four human ACs (speed per toggle, running counter, explicit close confirmation, "Did Not Attend" indicator).
