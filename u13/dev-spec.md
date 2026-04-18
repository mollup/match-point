# US13 Dev Spec — Player Match History

Short implementation spec for US13 (see `user-stories.md` §US13 for the user story and full acceptance criteria). This is deliberately scoped to the diff vs. the already-merged backend + frontend.

## 1. Data Model Delta

No new tables or types are added. Match history is computed on-the-fly from existing entrant and tournament data. Four new aggregate fields are added to the user profile response.

| Type | New field | Type | Purpose |
|---|---|---|---|
| User (profile response) | `totalTournaments` | `number` | Count of finalized tournaments this user entered. |
| User (profile response) | `totalWins` | `number` | Total match wins across all finalized tournaments. |
| User (profile response) | `totalLosses` | `number` | Total match losses across all finalized tournaments. |
| User (profile response) | `bestPlacement` | `number \| null` | Best placement rank in any finalized tournament (lower is better); `null` if no finalized tournaments. |

These fields are **computed** when fetching the user profile, not stored persistently. Computation requires iterating over `entrantsByTournament` and filtering for tournaments where `finalized === true`.

### New store helpers (`src/store.ts`)

- `getUserHistory(userId, options?) → HistoryEntry[]` — returns all finalized tournaments the user entered, sorted by date descending, with optional pagination (`page`, `pageSize`) and game filtering (`game`). Each entry includes:
  - `tournamentId`, `name`, `game`, `date`, `placement` (final rank), `wins`, `losses`.
- `getUserStats(userId) → { totalTournaments, totalWins, totalLosses, bestPlacement }` — computes aggregate stats from all finalized tournaments the user entered.

For placement/win-loss tracking, the store must maintain a `matchResults` map keyed by `tournamentId → userId → { placement, wins, losses }` or equivalent. This can be populated when a tournament is finalized or bracket results are recorded.

## 2. Endpoints

All endpoints live in `src/routes/users.ts` (new route file). No auth required for public endpoints.

| Method | Path | Auth | Behavior |
|---|---|---|---|
| `GET` | `/api/users/:id/history` | none | 404 if user missing; 200 with `{ history, page, pageSize, total }` where `history` is an array of tournament entries sorted by date descending. Accepts query params `?game=<game>&page=<N>&pageSize=<N>` (defaults: `page=1`, `pageSize=20`). Returns `[]` if no finalized tournaments match. |
| `GET` | `/api/users/:id` | none | Existing endpoint; extend response to include `totalTournaments`, `totalWins`, `totalLosses`, `bestPlacement` computed via `getUserStats(id)`. |

**Filtering**: When `?game=<game>` is present, only return history entries where the tournament's `game` field matches (case-insensitive).

**Pagination**: `page` is 1-indexed. `total` is the total count of matching history entries before pagination.

**History entry shape** (each item in `history[]`):
```typescript
{
  tournamentId: string,
  name: string,       // tournament name
  game: string,
  date: string,       // ISO 8601
  placement: number,  // final rank (1 = 1st, 2 = 2nd, etc.)
  wins: number,
  losses: number
}
```

## 3. Frontend Surface

### API client (`frontend/src/api.ts`)

Add two methods and extend one existing DTO:

- `getUserHistory(userId, options?) → Promise<{ history, page, pageSize, total }>` — `options` may include `{ game?, page?, pageSize? }`.
- Extend `UserProfile` type with `totalTournaments: number`, `totalWins: number`, `totalLosses: number`, `bestPlacement: number | null`.

### Changes to existing pages

- `PlayerProfilePage.tsx`
  - Add a "Match History" section below the user info card.
  - Display the most recent 10 results (call `getUserHistory(userId, { pageSize: 10 })`).
  - Each row shows: tournament name (as link to `/t/:id`), game, date (formatted `MMM D, YYYY`), placement (e.g., "3rd / 16"), W-L record (e.g., "2-1").
  - Show aggregate stats at the top of the section: "X tournaments · Y-Z record · Best: Nth".
  - Add a dropdown filter by game (populated from all games the user has entered; defaults to "All Games"). Selecting a game re-fetches history with `?game=<game>`.
  - Empty state: if `history.length === 0`, show "No tournament history yet — register for an event to get started" with a link to `/tournaments`.
  - State handling: Loading (spinner), Error (banner on failed API).

## 4. Tests

One integration test per machine AC in a new `src/history.test.ts`, mirroring the vitest + supertest patterns in `src/api.test.ts`. Minimum five tests:

1. `GET /api/users/:id/history` with one finalized tournament → 200, `history` contains one entry with correct fields.
2. `GET /api/users/:id/history?game=<game>` → filters by game; returns 200 with empty array if no finalized tournaments for that game.
3. `GET /api/users/:id/history` with pagination → respects `page` and `pageSize`; `total` reflects unfiltered count.
4. `GET /api/users/:id` includes `totalTournaments`, `totalWins`, `totalLosses`, `bestPlacement` (all zeros or null if no finalized tournaments).
5. `GET /api/users/:id/history` for non-existent user → 404.

## 5. Human Test Checklist

`u13/HumanTests.md` mirrors the US11 format and covers the four human ACs (10 results visible without scrolling, placement display, filtering without reload, empty state clarity).
