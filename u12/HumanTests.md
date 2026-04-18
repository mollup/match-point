# US12 — Human / smoke checklist (match-call notifications)

Run against a local `npm run dev` stack with two browser profiles (organizer + player).

1. **Bell + unread dot** — As a registered player in a tournament with a generated bracket, open the dashboard. Confirm the header bell shows a red dot when at least one unread match-call exists, and no dot when the list is empty.

2. **Panel content** — Click the bell. Confirm each row shows round number, opponent display name, optional station line if the organizer assigned `stationLabel` on the match (via devtools/API), and a sensible time for `createdAt`.

3. **Open bracket** — Click **Open bracket** on a notification. Confirm navigation to `/t/<tournamentId>/bracket` for the correct event.

4. **Ack** — Click **Got it** on a notification. Confirm the row disappears and the unread dot clears when that was the last item.

5. **Auth boundaries** — In DevTools Network, confirm `GET /api/users/<otherUserId>/notifications` returns **403** when logged in as a different user.
