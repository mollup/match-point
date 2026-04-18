US11 — Event Day Check-In

PREREQUISITES

Someone on the team must complete this setup before handing the app to the tester:

Run: npm run dev

Using an organizer account, go to /new and create a tournament named "Check-In Test" with game "Street Fighter 6."

Using at least three separate player accounts, register each of them for that tournament. (At least 3 entrants are required so the tester can observe both checked-in and no-show states.)

Copy the organizer credentials and the tournament URL (e.g., http://localhost:5173/t/abc123) and give both to the tester.

Leave check-in open (it is open by default on new tournaments).

TEST INSTRUCTIONS

Step 1 — Log in as the organizer
Open http://localhost:5173/login and log in with the organizer credentials provided by the test administrator. You should land on the dashboard.

Step 2 — Open the check-in page
Navigate to the tournament URL. Click the "Check-in" button in the header actions. You should land on the check-in page, which shows every registered entrant with a "Check in" button next to their name, and a counter near the top that reads "0 / N checked in."

Step 3 — Check players in
For each of the first two entrants in the list, click "Check in." Each click should complete in under one second, flip the button to "Undo," and increment the running counter. Confirm the counter now reads "2 / N checked in."

Step 4 — Undo a check-in (optional round-trip)
Click "Undo" next to one of the checked-in entrants. The button should flip back to "Check in" and the counter should decrement by one. Click "Check in" again to restore the check-in.

Step 5 — Close check-in with confirmation
Click "Close Check-In." A confirmation dialog should appear explaining that no-shows will be excluded from the bracket. Click "Yes, close check-in." The app should navigate you to the bracket page.

Step 6 — Confirm no-show exclusion + Did Not Attend badge
Return to the tournament detail page (/t/:id). The Entrants list should now show a small "Did Not Attend" badge next to the name of every entrant you did NOT check in. The entrants you did check in should appear with no badge. Open the bracket view — confirm that the no-show entrants do not appear in any match.

