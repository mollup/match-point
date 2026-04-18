# US13 — Player Match History

## PREREQUISITES

Someone on the team must complete this setup before handing the app to the tester:

Run: `npm run dev`

Using an organizer account, create at least two tournaments with different games (e.g., "Street Fighter 6" and "Tekken 8").

Using a single player account (call this "Test Player"), register that player for all tournaments.

For each tournament:
- Register at least 4 entrants total (including Test Player).
- Generate brackets and record match results so that the tournament has final placements.
- Mark each tournament as `finalized: true` (via backend or direct store manipulation).
- Ensure Test Player finishes in different placements across tournaments (e.g., 1st in one, 3rd in another).

Copy the Test Player user ID and the profile URL (e.g., `http://localhost:5173/players/:id`) and give both to the tester.

## TEST INSTRUCTIONS

### Step 1 — Open the player profile
Navigate to the Test Player's profile URL. You should land on the player profile page showing their name, games, and region at the top.

### Step 2 — Verify match history section exists and is visible
Scroll down (or look immediately below the user info card). You should see a "Match History" section that displays tournament results without scrolling past the fold on desktop. The section should show at most 10 tournament entries.

### Step 3 — Inspect history row details
Each tournament entry should clearly display:
- Tournament name (clickable link to the tournament detail page)
- Game name
- Date (formatted like "Apr 18, 2026")
- Placement (e.g., "1st", "2nd", "3rd", "4th")
- Win-loss record (e.g., "2-1")

Click one of the tournament name links. Confirm it navigates to the correct tournament detail page (`/t/:id`). Return to the profile.

### Step 4 — Check aggregate stats
At the top of the Match History section, verify that aggregate stats are displayed (e.g., "3 tournaments · 5-4 record · Best: 1st"). Confirm these match the sum of the individual tournament results.

### Step 5 — Filter by game
Locate the game filter dropdown (should default to "All Games"). Select one of the games (e.g., "Street Fighter 6"). The history list should immediately update to show only tournaments for that game **without a full page reload** (the URL may change or the page may feel instant). Confirm the counter and results reflect only the selected game. Switch back to "All Games" and confirm all results reappear.

### Step 6 — Verify public access
Log out (or open an incognito/private window) and visit the Test Player's profile URL again **without logging in**. Confirm the match history section displays exactly the same data as it did when you were logged in. There should be no private/public divergence.

### Step 7 — Check empty state
Using an organizer account, create a brand-new player account and register it for zero tournaments (or for tournaments that are not yet finalized).

Navigate to that new player's profile. The Match History section should display a clear empty state message: "No tournament history yet — register for an event to get started" (with a link to `/tournaments` or similar). The section should NOT show a broken widget, loading spinner, or error banner.
