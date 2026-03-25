# User Story
As a tournament organizer, I want to create a tournament with a player list and auto-generate a bracket so that I can run a structured event without manually laying out matchups.

Importance of the US
This is the foundational capability of MatchPoint. Bracket setup is the single biggest time sink organizers face — Persons 2, 11, 13, and 15 all cited it directly in discovery. Eliminating manual bracket configuration is the core value proposition that differentiates MatchPoint from a spreadsheet.

Machine Acceptance Criteria


POST /api/tournaments returns HTTP 201 with a valid tournament object (id, name, game).

POST /api/tournaments/:id/bracket generates a valid single-elimination bracket with ⌈log₂(n)⌉ rounds for n players.

Bracket seeding is deterministic for identical player inputs.

400 returned when fewer than 2 players are provided.

Only authenticated users with organizer role may create tournaments (403 otherwise).
Human Acceptance Criteria

An organizer can create a tournament and generate a bracket in under 2 minutes with no prior training.

The bracket display is visually readable — each matchup is clearly labeled with player names.

Player slots are correctly assigned with no duplicates or empty matchups.

The bracket page is shareable via a public URL without requiring login.

# Screens
- Create Tournament Flow
- Error & Validation State
- MatchPoint Dashboard
- Tournament Bracket View

# UI States
- Empty
- Loading
- Error
- Success

# Design Rationale

## Navigation
- **Why this screen exists:** Tournament creation with auto-generated brackets is MatchPoint's core value proposition. It replaces the manual bracket setup that is the single biggest time sink organizers face.
- **How users reach it:** From the MatchPoint Dashboard, the organizer taps "Create Tournament." The Create Tournament Flow collects event details and player list, then generates the bracket. The Tournament Bracket View is also reachable via a shareable public URL. Validation errors are shown inline on the creation form.

## Component Reuse
- Form input components (text fields, date picker, game dropdown, player list editor) shared with profile creation and registration forms
- Bracket visualization component shared with the live scoring screen (US3)
- Shared primary action button for "Create Tournament" and "Generate Bracket"
- Global nav bar with organizer dashboard breadcrumb
- Shared error/validation banner displaying field-level and form-level errors
- Shared loading spinner for bracket generation

## Accessibility
- Color contrast meets WCAG 2.1 AA (minimum 4.5:1 for form labels and bracket text, 3:1 for buttons and bracket lines)
- All form fields have visible `<label>` elements and validation error messages are linked via aria-describedby
- Bracket nodes include aria-labels (e.g., "Round 1, Match 1: Player A vs Player B")
- All buttons and interactive elements are at least 44×44 px
- Focus moves to the first validation error on failed submission; success redirects focus to the generated bracket view

# UI Element Mapping
| Element | Purpose | User Story |
|--------|--------|-----------|
| Tournament name field | Input for the event title | Create tournament |
| Game dropdown | Selects the game for the tournament | Create tournament |
| Date picker | Sets the tournament date and time | Create tournament |
| Player list editor | Adds and removes players for bracket seeding | Create tournament |
| Generate bracket button | Triggers auto-generation of the single-elimination bracket | Create tournament |
| Bracket visualization | Renders the generated bracket with rounds and matchups | Create tournament |
| Validation error banner | Displays field-level and form-level errors inline | Create tournament |
| Dashboard tournament card | Shows tournament summary on the organizer's MatchPoint Dashboard | Create tournament |
| Share URL button | Copies the public bracket link to clipboard | Create tournament |