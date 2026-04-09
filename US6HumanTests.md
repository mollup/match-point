US6 — Player Profile Creation

User Story: As a player, I want to create a profile listing my display name, games I play, and general location so that organizers and other community members can recognize and find me across events.

PREREQUISITES

Run: npm run dev

Open http://localhost:5173 in a browser.

Do not pre-create any account for the tester. They will register themselves as part of the test.

Have the tester's profile URL ready to check after they save: it will be http://localhost:5173/players/:id where :id is their user ID (visible in the URL after they navigate to their profile).

TEST INSTRUCTIONS

Step 1 — Create a player account
Go to http://localhost:5173/register. Fill in a display name, email, password (min 8 chars), and select "Player" as the role. Click Create account. You should land on the dashboard.

Step 2 — Navigate to your profile
In the navigation, find the Players section or go directly to /players. Find your own name or navigate to /players (your profile link may appear in the dashboard or navigation). Alternatively, the app may route you to /players/:id automatically.

Step 3 — Complete your profile
You should see a "NEW PROFILE" welcome screen prompting you to complete your profile. Click "Get Started" (or "SET LOCATION" / "ADD GAME" from the hints on the right side). An edit form appears with:

Display name (pre-filled from registration — you can change it)
Region (e.g., "Pittsburgh, PA")
Games (type a game name and press Enter or click Add — e.g., "Street Fighter 6", "Tekken 8")
Add at least two games and set a region. Click "Save Changes." A success toast should appear: "Profile updated successfully!"

Step 4 — Verify the profile view
After saving, you should see the profile view showing your display name, region, and the game tags you added. Confirm all three fields are visible and correct.

Step 5 — Edit the profile
Click "Edit Profile." Change your region to something different (e.g., "North America"). Click "Save Changes." Confirm the updated region is immediately shown on the profile page without a full page reload.

Step 6 — Verify public visibility (no login required)
Copy the profile URL from the address bar (e.g., http://localhost:5173/players/abc123). Open an incognito window. Paste the URL. Confirm the profile — display name, region, and games — is visible without logging in.

METRICS

Metric 1: Profile Completion Rate (no assistance)
What we measure: Whether the tester completes Steps 1–4 (account creation through a fully saved profile with display name, region, and at least one game) without asking for help.
Why this metric: A profile that players do not complete is invisible to organizers and the community — it delivers no value to either side. Per The Lean Startup, completion rate is actionable: if the tester abandons the profile form, there is a specific UX problem to fix. Per The Mom Test, observing where people stop is more informative than asking them why — the drop-off point is the finding.
Target: Tester completes a full profile (all three fields) unassisted.

Metric 2: Edit Success Rate (Step 5)
What we measure: Whether the tester can update their profile (change any field) and see the change reflected on the page immediately after saving — without a full page reload.
Why this metric: The human acceptance criteria explicitly states "edits are reflected immediately after saving." If users must reload to see their changes, they lose trust in whether the save worked and may edit repeatedly or contact support — creating exactly the kind of manual overhead the feature is meant to eliminate. This metric directly tests the stated criterion with a behavioral observation, not a preference question.
Target: Tester sees their edit reflected immediately after clicking Save Changes.

Metric 3: Information Findability (public profile, Step 6)
What we measure: Whether a person viewing the profile in an incognito window (simulating an organizer or community member) can immediately identify the player's display name, region, and games without scrolling or clicking through to another page.
Why this metric: The user story's stated purpose is that "organizers and other community members can recognize and find me across events." If the profile is technically public but the key fields are buried or missing, the story has not been satisfied. This metric captures whether the feature serves the audience that benefits from it — not just the player creating it. Per The Lean Startup, measuring value delivery to both sides of the two-sided use case is essential for a community platform.
Target: Incognito viewer can name the player's display name, region, and at least one game from the profile page without any interaction.

SURVEY QUESTIONS

Q1. If someone who organizes local gaming events wanted to know who you are as a player, what on your profile would you point them to?

(This question asks the tester to identify what they believe communicates their player identity — without leading them to evaluate any specific field. If they cannot identify anything useful, the profile is not serving its purpose. If they point to something not on the profile, that is a gap finding.)

Q2. Think back to filling out your profile. Was there anything you wanted to add that you couldn't?

(Framed as a memory question, not a feature request. Per The Mom Test, this surfaces real unmet needs rather than wishful thinking. If the tester says "I wanted to add a picture" or "I couldn't find where to put my ranking," those are genuine product signals. If they say "no," the current feature set is sufficient for this user.)

Q3. Would someone who doesn't know you be able to tell from your profile what kind of player you are?

(A reflective question that asks the tester to evaluate their own profile from the perspective of a stranger — which is exactly the profile's intended audience. This sidesteps the leading "is your profile good?" framing. A tester who says "yes, definitely" and explains why has validated the feature. A tester who hesitates or says "probably not" has surfaced.)

RESULTS TO FILL IN

Tester name and team:
Date:
Completion (yes/no, note where they stopped):
Edit success (did the profile update immediately after saving? yes/no):
Public visibility (could an incognito viewer identify display name, region, and game? yes/no):

Q1 response:
Q2 response:
Q3 response:

Outcome and follow-up actions:


