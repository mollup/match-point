US1 — Tournament Creation & Bracket Generation

PREREQUISITES
Someone on the team must complete this setup before handing the app to the tester:
From the root of the repository, run: npm run dev
This starts the API (port 3000) and frontend (port 5173). Wait until both are running.
Open http://localhost:5173 in a browser.
Have 2–4 people create player accounts ahead of time (role: Player) so the organizer has real entrants to generate a bracket with. Each player account needs: display name, email, password (min 8 chars), role = Player.
Do not pre-create an organizer account for the tester — they will do it themselves.

TEST INSTRUCTIONS
Step 1 — Create an organizer account
Go to http://localhost:5173/register. Fill in a display name, email, password (min 8 chars), and select "Tournament organizer" as the role. Click Create account. You should land on the dashboard.
Step 2 — Create a new tournament
Go to /new (or find the Create Tournament option). Enter an event name (e.g., "CMU Spring Invitational") and a game (e.g., "Street Fighter 6"). Click Publish event. You should be taken to the tournament detail page showing your tournament name and game.
Step 3 — Have players register
Share the tournament URL with the player accounts set up in prerequisites. Each player navigates to the tournament page and clicks "Sign up for this event," confirms their display name and game, and clicks "Confirm Registration." Wait until at least 2 players are listed in the Entrants section.
Step 4 — Generate the bracket
On the tournament detail page, click "Generate bracket." You should be taken to the bracket view. Confirm that all registered players appear in the bracket, matchups are labeled with player names, and the number of rounds looks correct (2 players = 1 round, 4 players = 2 rounds, 8 players = 3 rounds).
Step 5 — Check shareability
Copy the bracket page URL. Open an incognito window. Paste the URL. Confirm the bracket is visible without logging in.

METRICS
Metric 1: Task Completion Rate (no assistance)
What we measure: Whether the tester completes Steps 1–4 without asking for help or giving up.
Why this metric: An organizer who cannot complete the core workflow unassisted will never pay for the product. Completion rate is the most direct signal that the feature works for real users, not just the team that built it. Per The Lean Startup, it is actionable — a drop below 80% immediately points to a broken step in the funnel. Per The Mom Test, silent drop-off is invisible unless you measure it.
Target: Tester completed steps 1–4 unassisted.
Metric 2: Time on Task
What we measure: Clock time from opening /register to viewing a successfully generated bracket.
Why this metric: The human acceptance criteria specifies under 2 minutes with no prior training. Time on task is an objective proxy for UX friction and cognitive load. A feature that is technically correct but slow to use will not convert organizers away from their spreadsheets. This also catches subtle failures — confusing labels, hidden buttons — that completion rate alone misses.
Target: Under 2 minutes for a tester who has read the instructions once.
Metric 3: Bracket Comprehension (zero clarification questions)
What we measure: Whether the tester can identify, from the bracket view alone, (a) who plays whom in the first round, and (b) how many total rounds the tournament has — without asking anyone.
Why this metric: A bracket that is generated but unreadable delivers no value. This metric captures the difference between "the feature ran" and "the feature delivered its purpose." Per The Lean Startup's build-measure-learn loop, measuring whether the output is understood closes the loop on whether the core value proposition was actually realized.
Target: Tester answers both questions correctly without prompting.

SURVEY QUESTIONS
Q1. Walk me through what you just did — from when you first opened the app to when you saw the final bracket. What stood out to you?
(This open-ended recall question surfaces what was most memorable — positive or negative — without priming the tester. Unprompted observations are the most honest signal of what actually mattered, per The Mom Test.)
Q2. If a friend told you they were running a small local gaming tournament this weekend and asked what tools you use, what would you tell them?
(Framed as a concrete social scenario rather than "would you recommend this?" — which the Windows NPS example showed triggers sarcasm. A tester who volunteers MatchPoint is a genuine signal of product-market fit.)
Q3. What's the one thing you would change about the process you just went through?
(Constraining to one thing forces the tester to name their biggest pain point rather than listing everything or saying nothing. This avoids the leading framing of "did you have any problems?")

RESULTS TO FILL IN
Tester name and team:
Date:
Completion (yes/no, note where they stopped if not):
Time on task (minutes:seconds):
Bracket comprehension (could they identify matchups and round count without help? yes/no):
Q1 response:
Q2 response:
Q3 response:
Outcome and follow-up actions:
