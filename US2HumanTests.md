US2 — Player Registration for Events

PREREQUISITES

Someone on the team must complete this setup before handing the app to the tester:

Run: npm run dev

Using an organizer account, go to /new and create a tournament named "Test Open" with game "Street Fighter 6."

Copy the tournament URL (e.g., http://localhost:5173/t/abc123) and give it to the tester.

Leave registration open (it is open by default on new tournaments).

Have the organizer account credentials on hand — the tester will need them in Step 5.

The tester will create their own player account during the test. Do not hand them credentials.

TEST INSTRUCTIONS

Step 1 — Create a player account
Go to http://localhost:5173/register. Fill in a display name, email, password (min 8 chars), and select "Player" as the role. Click Create account. You should land on the dashboard.

Step 2 — Navigate to the tournament
Open the tournament URL provided by the test administrator. Confirm the tournament name "Test Open" and game "Street Fighter 6" are shown.

Step 3 — Register
Click "Sign up for this event." A form appears with Display Name (pre-filled) and Game (pre-filled). Click "Confirm Registration." A success message should appear.

Step 4 — Confirm you appear on the entrant list
Scroll to the Entrants section. Your display name should be listed. The "Sign up for this event" button should be gone, replaced by "✓ You are registered."

Step 5 — Confirm the organizer sees you
Open an incognito window. Log in at /login with the organizer credentials. Navigate to the same tournament URL. Without refreshing, confirm the player's display name appears in the Entrants list.

METRICS

Metric 1: Registration Completion Rate (no assistance)
What we measure: Whether the tester completes Steps 1–4 without help, hitting an unrecoverable error, or abandoning.
Why this metric: If a player cannot register unassisted, the organizer is still collecting names manually — the friction is not eliminated, just shifted. Per The Lean Startup, completion rate is actionable: a drop below 80% directly points to a broken step in the funnel that must be fixed before the feature can ship.
Target: Tester completes registration unassisted.

Metric 2: Confirmation Clarity
What we measure: Whether the tester, immediately after Step 3, can correctly state without prompting that they are now registered. We ask: "What just happened?" If they say any variant of "I registered / I'm in / it confirmed me," this passes.
Why this metric: A successful database write the user cannot perceive has no value. Per The Mom Test, users will not volunteer confusion — they will quietly assume something went wrong and contact the organizer separately, negating the entire point of US2. Comprehension must be measured directly, not inferred from completion.
Target: Tester immediately understands they are registered after Step 3.

Metric 3: Entrant Visibility (organizer's view)
What we measure: Whether the registered player appears in the organizer's entrant list without any manual refresh or admin action.
Why this metric: The user story's value is that the organizer does not need to collect info manually. If the list does not update automatically, the organizer still has to chase players or refresh constantly — the friction is moved, not eliminated. This metric directly tests the stated acceptance criterion and is a behavior-level test immune to social desirability bias.
Target: Tester confirms the player appears in the organizer's list without a manual refresh.

SURVEY QUESTIONS

Q1. After you clicked "Confirm Registration," how did you know whether it worked?

(This probes whether the confirmation feedback was sufficient without asking "was it clear?" — which primes a positive answer. If the tester says "I wasn't sure" or "I had to scroll down to check," that is a direct signal the success state needs improvement.)

Q2. Imagine you're telling a teammate who missed out on an event about how you signed up for this one. What would you say?

(Framed as a concrete social scenario rather than a hypothetical. A tester who describes the process positively and concisely is implicitly endorsing it. Per The Mom Test, the story they tell a peer is more honest than any direct rating.)

Q3. Was there any moment during sign-up where you weren't sure what to do next?

(Asking about specific moments of uncertainty is concrete and easy to answer honestly. "No" is a strong positive signal. A described moment is an actionable design finding.)

RESULTS TO FILL IN

Tester name and team:
Date:
Completion (yes/no, note where they stopped):
Confirmation clarity (did they immediately know they were registered? yes/no):
Entrant visibility (did player appear in organizer's list without refresh? yes/no):

Q1 response:
Q2 response:
Q3 response:

Outcome and follow-up actions:
