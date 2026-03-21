# MatchPoint — User Stories
**Project 2 Deliverable · 5-Member Team · 10 User Stories · Spring 2026**

---

## 1. User Stories

---

### ★ US1 (CORE): Tournament Creation & Bracket Generation

**User Story**
> As a tournament organizer, I want to create a tournament with a player list and auto-generate a bracket so that I can run a structured event without manually laying out matchups.

**Why This Matters**
This is the foundational capability of MatchPoint. Without it, nothing else works. Discovery interviews confirmed that bracket setup is the single biggest time sink organizers face — Persons 2, 11, 13, and 15 all cited it directly. Eliminating manual bracket configuration is the core value proposition that differentiates MatchPoint from a spreadsheet.

**Machine Acceptance Criteria**
- `POST /api/tournaments` returns HTTP 201 with a valid tournament object including an ID, name, and game.
- `POST /api/tournaments/:id/bracket` with a player list generates a valid single-elimination bracket with correct round count (⌈log₂(n)⌉ rounds for n players).
- Bracket seeding is deterministic for identical player inputs.
- 400 returned when fewer than 2 players are provided.
- Only authenticated users with organizer role may create tournaments (403 otherwise).

**Human Acceptance Criteria**
- An organizer can create a tournament and generate a bracket in under 2 minutes with no prior training.
- The bracket display is visually readable — each matchup is clearly labeled with player names.
- Player slots are correctly assigned with no duplicates or empty matchups.
- The bracket page is shareable via a public URL without requiring login.

**INVEST Evaluation**
Independent (~): nearly self-contained; only requires an auth system. Negotiable: bracket format (single-elim vs double-elim) and seeding algorithm can be adjusted. Valuable: core product functionality. Estimable: bracket generation is a well-understood algorithm. Small: fits in one sprint; if needed, tournament creation and bracket rendering can be split. Testable: bracket output is deterministic — outcomes can be fully machine-verified.

---

### US2: Player Registration for Events

**User Story**
> As a player, I want to register for a tournament through the platform so that I am automatically added to the entrant list without the organizer needing to collect my info manually.

**Why This Matters**
Manual entry collection — via cash at the door, Discord DMs, or Google Forms — is error-prone and time-consuming. Automating registration directly addresses the operational burden organizers described (Persons 11, 15) and lowers the barrier for new players to enter events. It also feeds clean data into bracket generation (US1), making both stories more valuable together.

**Machine Acceptance Criteria**
- `POST /api/tournaments/:id/register` with a valid auth token returns HTTP 201 and a registration record.
- 409 returned on duplicate registration for the same user and tournament.
- 400 returned when required fields (display name, game selection) are missing.
- Registered player count on the tournament object increments correctly after each registration.
- `GET /api/tournaments/:id/entrants` returns an accurate, ordered list of all registered players.

**Human Acceptance Criteria**
- A player can register for a tournament in under 60 seconds from the event page.
- A confirmation message is clearly displayed immediately after registration.
- The player appears on the organizer's entrant list in real time without a page refresh.
- If registration is full or closed, the player sees a clear, informative message explaining why.

**INVEST Evaluation**
Independent (~): depends on US1 (tournament must exist) and US6 (player profile), but can be developed with stubs. Negotiable: entry fee collection timing and required fields are flexible. Valuable: directly reduces organizer workload and lowers barriers for new players. Estimable: straightforward CRUD with validation. Small: comfortably fits in one sprint. Testable: form validation and database writes are trivially machine-testable.

---

### US3: Live Score Tracking

**User Story**
> As a tournament organizer, I want to update match scores in real time during an event so that players and spectators can follow the current bracket state without needing a physical scoreboard or separate stream.

**Why This Matters**
Persons 15 and 11 explicitly asked for automated or streamlined score tracking. The current workflow requires organizers to manually track results and update shared screens — if one person leaves, the whole system breaks. Live score tracking is the feature most likely to convert new organizers, as it directly replaces the most fragile part of their current setup and is also visible to all attendees, functioning as a live advertisement for the platform.

**Machine Acceptance Criteria**
- `PUT /api/matches/:id/score` with valid score data returns HTTP 200 and the updated match object.
- Bracket state reflects the winner advancing to the next round within 3 seconds of score submission.
- Scores update on the public bracket page without a full page reload (polling or WebSocket).
- 403 returned when a non-organizer user attempts to submit a score update.
- 400 returned for invalid score formats (e.g., negative values, non-integers).

**Human Acceptance Criteria**
- An organizer can input a match result in 3 clicks or fewer from the bracket view.
- The bracket display visibly updates — the winner's name moves to the next round — without a manual refresh.
- Spectators on a separate device see score changes within 5 seconds.
- A completed bracket clearly indicates the overall tournament winner.

**INVEST Evaluation**
Independent (~): builds on US1 and US2, but those can be stubbed. Negotiable: real-time method (WebSocket vs. short-poll), update frequency, and score format are flexible. Valuable: highest-impact differentiator vs. manual methods; the feature organizers most need mid-event. Estimable: well-defined API endpoints; real-time sync adds some complexity. Small (~): push-based updates could extend to 3 weeks; polling reduces scope to well within 2. Testable: score updates and winner advancement are deterministic and fully machine-testable.

---

### US4: Replay Upload & Storage

**User Story**
> As a tournament organizer, I want to upload match video replays after an event ends so that players can find and revisit tournament footage in one centralized place.

**Why This Matters**
Paper prototype testing revealed that replay browsing was the most positively received feature — multiple testers praised it as providing a "third place" for community content outside of Twitch or YouTube. Person 3 and Person 18 both noted the frustration of manually distributing replays. This story sets up the replay infrastructure that US5 (browsing) depends on, making it a prerequisite for one of MatchPoint's key differentiators.

**Machine Acceptance Criteria**
- `POST /api/replays` accepts a video file and metadata (player names, game, event ID) and returns HTTP 201 with the replay record.
- Uploaded file is stored and accessible via the returned URL within 30 seconds.
- 413 returned for files exceeding the size limit (configurable, default 2 GB).
- Only authenticated organizers may upload replays for their own events (403 otherwise).
- `GET /api/replays/:id` returns the full replay object including metadata and accessible video URL.

**Human Acceptance Criteria**
- An organizer can upload a replay file with metadata filled in within 3 minutes.
- A progress indicator is displayed during upload with a clear completion state.
- The replay appears in the event's replay list immediately after upload completes.
- Title, game, player names, and event name are correctly displayed on the replay card.

**INVEST Evaluation**
Independent: no hard dependency on real-time score tracking. Negotiable: storage provider (S3, GCS, etc.), supported formats, and size limits are all flexible. Valuable: directly enables the replay discovery feature testers responded to most positively. Estimable: file upload with metadata is a well-understood engineering pattern. Small: a single sprint is sufficient for basic upload and storage. Testable: upload success/failure and metadata correctness are binary and machine-verifiable.

---

### US5: Replay Discovery & Browsing

**User Story**
> As a player, I want to search and browse match replays by game, event, or player name so that I can study my own matches and watch others without digging through YouTube or Twitch archives.

**Why This Matters**
This is the feature that prompted the strongest positive reaction during paper prototype testing. Testers described it as creating a dedicated community space — a "third place" — for fighting game content. The value is two-sided: players get a learning tool, and the platform gains sticky, repeat engagement. Persons 3, 18, and 20 all expressed pain around content discoverability. This story completes the replay workflow started in US4.

**Machine Acceptance Criteria**
- `GET /api/replays` with optional query params (game, event_id, player_name) returns a filtered, paginated list (default 20 per page).
- An empty filter returns all public replays in reverse-chronological order.
- Search response time is under 500 ms for a dataset of up to 10,000 replays.
- Each replay object includes: title, game, players, event name, date, and video URL.
- Pagination returns correct slices with accurate total count metadata.

**Human Acceptance Criteria**
- A player can find a specific match by player name within 3 clicks from the replay browse page.
- Each replay card shows enough information (game, players, event, date) to identify the match before clicking.
- Clicking play loads the video inline or opens it without broken links.
- Filtering by game or player name visibly narrows results without a full page reload.

**INVEST Evaluation**
Independent (~): requires US4 to have meaningful data, but the API and UI can be built and tested with seeded data. Negotiable: filter types, sort order, and UI layout are flexible. Valuable: highest-rated feature from prototype testing; core differentiator for the platform. Estimable: basic search and filtering is straightforward. Small: fits in one sprint with basic filters; advanced search can be a follow-on. Testable: filter results are deterministic for given inputs — fully machine-testable.

---

### US6: Player Profile Creation

**User Story**
> As a player, I want to create a profile listing my display name, games I play, and general location so that organizers and other community members can recognize and find me across events.

**Why This Matters**
A player profile is the identity foundation of MatchPoint. Without it, registration (US2), leaderboards (US8), and social features (US9) have no persistent user entity to anchor to. The spec emphasizes that MatchPoint is built around the player's journey — the profile is where that journey lives. It also enables cross-event reputation, which is what Person 1 requested when they asked for a persistent player ranking (PR).

**Machine Acceptance Criteria**
- `POST /api/users` creates a user with required fields (username, email, games array, region) and returns HTTP 201.
- `GET /api/users/:id` returns the full public profile without requiring authentication.
- 409 returned for duplicate username or email.
- `PATCH /api/users/:id` with valid auth updates only the provided fields and returns the updated profile.
- Deleted or non-existent user IDs return 404.

**Human Acceptance Criteria**
- A new user can complete profile creation in under 2 minutes.
- The profile page clearly shows the player's display name, games, and region.
- Edits to the profile are reflected immediately on the profile page after saving.
- The profile is publicly viewable by anyone without requiring a login.

**INVEST Evaluation**
Independent: no dependencies on other user stories; can be built and tested in isolation. Negotiable: required fields, profile picture support, and privacy settings are flexible. Valuable: foundational identity layer that enables registration, leaderboards, and social features. Estimable: standard CRUD — the simplest user story to scope. Small: well within a single sprint. Testable: all fields are verifiable via API response; validation rules are straightforward machine tests.

---

### US7: Event Discovery & Filtering

**User Story**
> As a player, I want to browse and filter upcoming local tournaments by game and location so that I can find events to attend without searching across Discord, Reddit, and Facebook.

**Why This Matters**
The product spec identifies event fragmentation as the central player-facing problem. MatchPoint's pitch is a single place that replaces bouncing between Discord servers, Reddit threads, and Facebook groups. Event discovery is the primary entry point for new users — if players cannot quickly find relevant events, they have no reason to create a profile, register, or return.

**Machine Acceptance Criteria**
- `GET /api/events` with optional params (game, city, radius_km) returns filtered, upcoming events sorted by date ascending.
- Events with a start date in the past are excluded from the default results.
- Each event object includes: name, game, date, venue name, city, and current entrant count.
- Response time under 400 ms for datasets up to 5,000 events.
- Empty results return an empty array with HTTP 200 (not 404).

**Human Acceptance Criteria**
- A player can find events in their city for their game within 3 clicks from the home page.
- Events are sorted by date with the soonest first by default.
- Applying a game or location filter visibly narrows the results without a full page reload.
- Each event card shows enough information to decide whether to attend without clicking through.

**INVEST Evaluation**
Independent (~): requires events to exist (from US1), but can be developed with seeded data. Negotiable: filter types (radius, game genre, bracket format) are flexible. Valuable: primary player-facing value that drives sign-ups and platform adoption. Estimable: read-only filtering is one of the simplest engineering tasks. Small: comfortably fits within one sprint. Testable: filtering logic is deterministic — given a fixed dataset and filter params, results are fully predictable and machine-verifiable.

---

### US8: Player Leaderboard / Power Rankings

**User Story**
> As a player, I want to see a ranked leaderboard based on local tournament results so that I can track my standing in the Pittsburgh FGC and measure my progress over time.

**Why This Matters**
Person 1 explicitly requested a player ranking (PR) system in the discovery interviews — it was the first pain point raised. Leaderboards create a compelling retention loop: players return to the platform not just to register for events, but to check their rank after each tournament. This transforms MatchPoint from a utility into a community hub, which is central to the freemium engagement model described in the product spec.

**Machine Acceptance Criteria**
- `GET /api/leaderboard?game=` returns a ranked list of players sorted by points descending.
- Points update correctly within 1 hour of a tournament result being finalized in the system.
- `GET /api/leaderboard?game=&player_id=` returns the requesting player's rank and surrounding entries.
- Pagination returns correct slices with an accurate total count.
- Only tournaments marked as finalized contribute to leaderboard points.

**Human Acceptance Criteria**
- A player can find their own rank on the leaderboard for their game within 2 clicks.
- Rank changes from a recent tournament are reflected on the leaderboard within 24 hours.
- The active game filter is clearly displayed so the player knows which leaderboard they are viewing.
- The leaderboard distinguishes between players with the same point total using a visible tiebreaker.

**INVEST Evaluation**
Independent (~): depends on finalized tournament data from US1 and US3, but can be built with seeded results. Negotiable: point calculation formula, tiebreaker logic, and game scope are flexible. Valuable: directly requested by interviewees; creates a key retention loop. Estimable: ranking calculation is algorithmic and well-scoped. Small: fits in one sprint for basic ranking; advanced Elo-style systems can be a follow-on. Testable: given a fixed set of tournament results, leaderboard rankings are fully deterministic and machine-verifiable.

---

### US9: Follow Players (Social Layer)

**User Story**
> As a player, I want to follow other players so that I can track their upcoming events, recent results, and activity without manually checking the platform every day.

**Why This Matters**
The product spec describes a "social layer that lets players follow local rivals, track progress, and connect with others nearby" as a core differentiator vs. start.gg and Challonge. Following creates passive engagement: a player who follows their rival has a reason to return to the platform even when they are not entering a tournament. This social glue is essential for transitioning MatchPoint from a transactional tool into a community platform.

**Machine Acceptance Criteria**
- `POST /api/follows` with a target user ID creates a follow relationship and returns HTTP 201.
- `DELETE /api/follows/:id` removes the follow relationship and returns HTTP 200.
- `GET /api/users/:id/following` returns a paginated list of followed users with their basic profile info.
- 409 returned on a duplicate follow attempt.
- `GET /api/users/:id/followers` returns a paginated list of users who follow the given player.

**Human Acceptance Criteria**
- A follow button is visible and clearly labeled on every player profile page.
- Clicking Follow changes the button state immediately (no page reload required).
- Followed players appear in a "Following" tab or list on the logged-in user's profile.
- Unfollowing a player removes them from the Following list within one page load.

**INVEST Evaluation**
Independent (~): requires player profiles (US6) to exist, but the relationship logic is otherwise isolated. Negotiable: feed algorithm, notification preferences, and what "following" surfaces are flexible. Valuable: social retention mechanism that supports the platform's community positioning. Estimable: a follow relationship is a simple join table — one of the most standard patterns in web development. Small: fits comfortably within one sprint. Testable: follow/unfollow state is binary and list membership is verifiable.

---

### US10: Premium Subscription Upgrade

**User Story**
> As a tournament organizer, I want to upgrade to a premium subscription so that I can access advanced features like stream overlays and automated video uploads without ads on my event pages.

**Why This Matters**
Without a monetization path, MatchPoint cannot sustain itself. The updated value proposition specifically calls out a freemium model as the revenue engine after user feedback rejected the pay-per-event approach. Premium subscriptions convert the platform's most engaged users — frequent organizers — into paying customers, and the resulting recurring revenue funds ongoing development. This story is the business viability proof.

**Machine Acceptance Criteria**
- `POST /api/subscriptions` creates a Stripe payment intent and returns a client secret for frontend confirmation.
- Subscription status is marked active on the organizer account within 60 seconds of successful payment.
- Premium-gated features return 403 for non-subscribers and 200 for active subscribers.
- An expired or cancelled subscription correctly reverts the account to the free tier within 1 hour.
- `GET /api/subscriptions/:user_id` returns current subscription status and expiry date.

**Human Acceptance Criteria**
- The upgrade flow from the organizer dashboard to an active premium account completes in under 3 minutes.
- A premium badge is visible on the organizer's public profile after successful payment.
- Premium features are immediately accessible after payment confirmation — no manual intervention needed.
- The organizer receives a clear confirmation (on-screen and via email) with their subscription details.

**INVEST Evaluation**
Independent: feature gating can be added incrementally; Stripe integration is self-contained. Negotiable: price, feature set, billing cycle, and trial period are highly flexible. Valuable: direct revenue generation; proves business viability. Estimable: Stripe integration is well-documented; the main complexity is feature gating logic. Small (~): Stripe's hosted checkout reduces scope significantly, though end-to-end payment flows may push toward 3 weeks; scope to basic subscribe/cancel first. Testable: Stripe provides a test mode with fake card numbers — payment flows and subscription status transitions are fully machine-testable.

---

## 2. INVEST Framework Summary

| Story | Independent | Negotiable | Valuable | Estimable | Small | Testable |
|-------|:-----------:|:----------:|:--------:|:---------:|:-----:|:--------:|
| US1 ★ | ~ | ✓ | ✓ | ✓ | ✓ | ✓ |
| US2   | ~ | ✓ | ✓ | ✓ | ✓ | ✓ |
| US3   | ~ | ✓ | ✓ | ✓ | ~ | ✓ |
| US4   | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| US5   | ~ | ✓ | ✓ | ✓ | ✓ | ✓ |
| US6   | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| US7   | ~ | ✓ | ✓ | ✓ | ✓ | ✓ |
| US8   | ~ | ✓ | ✓ | ✓ | ✓ | ✓ |
| US9   | ~ | ✓ | ✓ | ✓ | ✓ | ✓ |
| US10  | ✓ | ✓ | ✓ | ✓ | ~ | ✓ |

> **Key:** ✓ fully meets · ~ partially meets (minor caveat) · ✗ does not meet

The ~ marks are minor: US1/US2/US5/US7–US9 share logical dependencies on earlier stories (can be developed with stubs), US3 and US10 have real-time / payment complexity that could push past 2 weeks if not scoped carefully. None are blockers.

---

## 3. Evaluation Analysis

### 3a. Most Critical to Business Success

| Story | Title | Rationale |
|-------|-------|-----------|
| **US1 ★** | Tournament Creation & Bracket Generation | This is the product. Without working bracket generation, MatchPoint has no reason to exist. Directly solves the pain point raised by the largest cluster of interviewees (Persons 2, 11, 13, 15). |
| **US3** | Live Score Tracking | The key differentiator. Replaces the most failure-prone part of organizers' current workflow and is visible to every attendee, making it MatchPoint's most powerful word-of-mouth vector. |
| **US5** | Replay Discovery & Browsing | User testing identified this as the most compelling feature. Transforms MatchPoint from a utility into a destination — the "third place" for FGC content — essential for the freemium ad-revenue model. |

### 3b. Easiest to Implement

| Story | Title | Rationale |
|-------|-------|-----------|
| **US6** | Player Profile | Pure CRUD with standard validation. No async operations, no external dependencies, no business logic beyond field validation. The simplest database pattern in the application. |
| **US7** | Event Discovery | A read-only filtered query on the events table. No writes, no real-time requirements, no external APIs. A handful of query parameters and a list endpoint. |
| **US9** | Follow Players | A join table with two foreign keys. Follow and unfollow are two endpoints. The only complexity is preventing duplicate follows, which is a standard database constraint. |

### 3c. Easiest to Test via Machine-Executable Tests

| Story | Title | Rationale |
|-------|-------|-----------|
| **US1** | Tournament Creation & Bracket Generation | Bracket generation is a deterministic algorithm. Given the same player list, the output is always identical. Round count, seeding, and matchup assignments can all be asserted programmatically. |
| **US2** | Player Registration | Form validation and database writes are binary — either they succeed or they fail. Duplicate checks, missing field handling, and count increments are all trivially assertable in unit and integration tests. |
| **US8** | Player Leaderboard / PR | Leaderboard ranking is a pure function of tournament results. Given a fixed set of results as test fixtures, the expected ranking is fully deterministic and verifiable at every position. |

### 3d. Easiest for a Human to Verify as Satisfactorily Implemented

| Story | Title | Rationale |
|-------|-------|-----------|
| **US3** | Live Score Tracking | The behavior is immediately observable: a human inputs a score and watches the bracket update in real time. There is no ambiguity — either the winner advances or they do not. |
| **US5** | Replay Discovery & Browsing | A human can type a player's name, see filtered results, click a replay, and watch it. The entire experience is visual and immediate, with no hidden state to inspect. |
| **US7** | Event Discovery | A human can select a game filter and immediately see the list narrow. The correct behavior is visually self-evident — upcoming events for that game appear, past events do not. |

---

## 4. Implementation Priority Order

Priority is determined by three factors: (1) dependency chains — stories that unlock others come first; (2) organizer-side features before player-side, since organizers create the content players consume; (3) revenue features last, after the platform has proven adoption.

| Rank | Story | Title | Justification |
|------|-------|-------|---------------|
| 1 | **US1 ★ CORE** | Tournament Creation & Bracket Generation | Everything depends on this |
| 2 | US6 | Player Profile | Identity layer needed before registration or social features |
| 3 | US2 | Player Registration | Brackets need entrants; unlocks full US1 flow |
| 4 | US3 | Live Score Tracking | Key real-time differentiator vs. existing tools |
| 5 | US7 | Event Discovery | Player-facing value; drives sign-ups and retention |
| 6 | US4 | Replay Upload | Top-rated feature from paper prototype feedback |
| 7 | US5 | Replay Discovery & Browsing | Completes the replay experience as a "third place" |
| 8 | US8 | Player Leaderboard / PR | Community engagement; directly requested in discovery |
| 9 | US9 | Follow Players | Social glue that drives repeat visits |
| 10 | US10 | Premium Subscription | Monetization; needs platform traction before it converts |

> **★ US1 is the CORE user story.** It must be the first story implemented. All other stories either depend on it directly or depend on stories that depend on it.

---

## 5. GitHub Issues

Each user story should be created as a GitHub Issue with its full acceptance criteria, priority label, sprint assignment, and primary/secondary owner assignments. Replace the placeholder URLs below with your actual issue links after creation.

| Story | Title | Priority | Sprint | GitHub Issue URL |
|-------|-------|:--------:|:------:|------------------|
| US1 ★ | Tournament Creation & Bracket Generation | P0 | Sprint 1 | *(paste URL)* |
| US2 | Player Registration for Events | P0 | Sprint 1 | *(paste URL)* |
| US3 | Live Score Tracking | P0 | Sprint 2 | *(paste URL)* |
| US4 | Replay Upload & Storage | P1 | Sprint 2 | *(paste URL)* |
| US5 | Replay Discovery & Browsing | P1 | Sprint 3 | *(paste URL)* |
| US6 | Player Profile Creation | P0 | Sprint 1 | *(paste URL)* |
| US7 | Event Discovery & Filtering | P1 | Sprint 2 | *(paste URL)* |
| US8 | Player Leaderboard / PR | P2 | Sprint 3 | *(paste URL)* |
| US9 | Follow Players (Social Layer) | P2 | Sprint 3 | *(paste URL)* |
| US10 | Premium Subscription Upgrade | P2 | Sprint 4 | *(paste URL)* |

> **Priority levels:** P0 = must have for MVP (Sprint 1–2) · P1 = core experience (Sprint 2–3) · P2 = full product (Sprint 3–4)

---

## 6. LLM Usage Disclosure

An LLM (Claude, Anthropic) was used to assist with drafting and structuring the user stories in this document. The inputs provided were the full Project 1 product specification PDF, the 20 interview summaries, and the updated value proposition. The team reviewed all generated content against the discovery data and modified stories where the LLM's framing did not reflect what interviewees actually said.
