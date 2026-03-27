# User Story
As a player, I want to register for a tournament through the platform so that I am automatically added to the entrant list without the organizer needing to collect my info manually.

Importance of the US
Manual entry collection via Discord DMs or Google Forms is error-prone. Automating registration directly addresses the operational burden organizers described (Persons 11, 15) and feeds clean data into bracket generation (US1).

Machine Acceptance Criteria


POST /api/tournaments/:id/register with a valid auth token returns HTTP 201 and a registration record.

409 returned on duplicate registration for the same user and tournament.

400 returned when required fields (display name, game selection) are missing.

Registered player count on the tournament object increments correctly after each registration.

GET /api/tournaments/:id/entrants returns an accurate, ordered list of all registered players.
Human Acceptance Criteria

A player can register for a tournament in under 60 seconds from the event page.

A confirmation message is clearly displayed immediately after registration.

The player appears on the organizer's entrant list in real time without a page refresh.

If registration is full or closed, the player sees a clear, informative message explaining why.

# Screens
- Registering... (Loading)
- Registration Successful
- Registration Unavailable (Error)
- Tournament Registration

# UI States
- Empty
- Loading
- Error
- Success

# Design Rationale

## Navigation
- **Why this screen exists:** Players need to register for tournaments directly on the platform so they are added to the entrant list automatically without manual organizer intervention.
- **How users reach it:** From a tournament detail page (linked via tournament discovery or a shared URL), the player taps a "Register" button. The flow progresses: Tournament Registration form → Registering... (Loading) → Registration Successful (or Registration Unavailable on error).

## Component Reuse
- Shared primary action button for "Register" and "Done"
- Form input components (display name, game selection dropdown) reused from profile creation and tournament creation
- Global nav bar with tournament context breadcrumb
- Shared loading spinner component
- Shared error banner component with a descriptive message (e.g., registration full, event closed)
- Shared success confirmation component (checkmark + message)

## Accessibility
- Color contrast meets WCAG 2.1 AA (minimum 4.5:1 for form labels and body text, 3:1 for buttons)
- All form fields have visible `<label>` elements — not placeholder-only
- Register button is at least 44×44 px and includes an aria-label (e.g., "Register for Steel City Weekly #12")
- Registration success and error states are announced via aria-live regions
- Focus is managed through the flow — moves to the confirmation message on success or to the error message on failure

# UI Element Mapping
| Element | Purpose | User Story |
|--------|--------|-----------|
| Register button | Submits the player's registration for the tournament | Tournament registration |
| Display name field | Pre-filled or editable player name for the entrant list | Tournament registration |
| Game selection dropdown | Lets the player confirm which game they are entering | Tournament registration |
| Loading spinner | Shown while the registration request is processing | Tournament registration |
| Success confirmation | Displays a checkmark and message confirming registration | Tournament registration |
| Error message | Informs the player that registration is unavailable (full/closed) | Tournament registration |
| Entrant count badge | Shows current number of registered players on the tournament page | Tournament registration |