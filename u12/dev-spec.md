# US12 Dev Spec — Match-call in-app notifications

Implementation spec for US12 (match ready → player notifications). Builds on US1/US2/US11 bracket + entrants.

## 1. Data model (`src/types.ts`)

- **`BracketMatch`** gains:
  - `status: "pending" | "ready" | "complete"`
  - `winnerUserId: string | null`
  - `stationLabel?: string | null` (optional metadata for the venue)
- **`MatchCallNotification`** (in-memory): `id`, `userId`, `kind: "match_call"`, `tournamentId`, `matchId`, `round`, `opponentDisplayName`, `stationLabel`, `read`, `createdAt`.
- **DTO** `MatchCallNotificationDTO` for API responses (no internal `kind`/`read` in list payload).

## 2. Bracket state (`src/bracket/bracketState.ts`)

- **`syncBracketDerivedState(bracket)`** — After byes are normalized in round 1, recomputes feeder advancement into later rounds (using recorded winners + bye rules), assigns each match `status`, and returns **`matchId`s that newly transitioned to `ready`** (for notification enqueue).
- **`recordMatchWinner(bracket, matchId, winnerUserId)`** — Organizer-facing progression; runs sync and returns the same `newlyReady` id list.

`buildSingleEliminationBracket` initializes `status`, `winnerUserId`, `stationLabel` on every match.

## 3. Store (`src/store.ts`)

- In-memory maps: `notificationsById`, idempotency set keyed by `` `${tournamentId}\0${matchId}\0${playerId}` ``.
- **`setTournamentBracket`** — Runs `syncBracketDerivedState`, persists bracket, then **`enqueueMatchReadyNotifications(tournamentId, newlyReadyMatchIds)`** (immediate, within SLA).
- **`enqueueMatchReadyNotifications`** — For each ready match, for each side: skip if user is **not** in `getEntrants(tournamentId)`; skip if idempotency key exists; else insert unread `match_call` row.
- **`listUnreadMatchCallNotifications`**, **`markNotificationRead`**, **`reportBracketMatchWinner`** (returns `{ bracket, newlyReadyMatchIds }`), **`setMatchStationLabel`** (optional; used when tests need a non-null station).

## 4. HTTP API

| Method | Path | Auth | Behavior |
|--------|------|------|----------|
| `GET` | `/api/users/:id/notifications` | Bearer | **200** — unread `match_call` DTOs for caller only; **403** if `:id` ≠ JWT subject. |
| `POST` | `/api/notifications/:id/ack` | Bearer | **200** `{ ok: true }`; **404** missing id; **403** if notification belongs to another user. |
| `POST` | `/api/tournaments/:id/matches/:matchId/winner` | Organizer | Body `{ winnerUserId }`. Advances bracket, enqueues notifications for newly ready matches. **400** invalid progression; **404** no bracket. |

`GET /api/users/:id/notifications` is registered **before** `GET /api/users/:id` in the users router.

## 5. Frontend

- **`frontend/src/api.ts`** — `MatchCallNotificationDTO`, extended `BracketMatch`; `getMatchCallNotifications`, `ackMatchCallNotification`.
- **`DashboardLayout`** — Bell control loads unread list (poll ~45s), dropdown with round/opponent/station/time, links to `/t/:tournamentId/bracket`, **Got it** → ack.

## 6. Tests

- **`src/notifications.test.ts`** — Maps each machine acceptance criterion (enqueue on ready, GET shape +403, ack 200/404/403, non-entrant fixture, idempotency, later-round ready after winner, station in payload).

## 7. Human checklist

See `u12/HumanTests.md`.
