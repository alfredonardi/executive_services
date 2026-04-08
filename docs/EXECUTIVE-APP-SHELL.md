# Executive App Shell — Phase 6

This document covers the Prompt 6 work that completes the executive-facing mobile shell so the product no longer feels partially mocked.

## What Prompt 6 completes

- The Today tab now loads live schedule and free-window data from the backend.
- Calendar connection is now available inside the mobile app for both Google and Microsoft.
- The app now includes a profile/settings flow for account-level preferences and recommendation preferences.
- The app now includes a notification center backed by the existing notifications API.
- The mobile shell now exposes notifications and settings from the top-level tabs through shared header actions.

## Backend additions

### New endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/today` | Executive-ready Today view with events, free windows, sync status, and connection state |
| `GET` | `/api/v1/me` | Authenticated executive profile and account preferences |
| `PATCH` | `/api/v1/me` | Update profile fields and account-level preferences |

### Extended endpoints

| Method | Path | Change |
|---|---|---|
| `POST` | `/api/v1/calendar/google/connect` | Accepts optional `{ redirectUri }` for native deep-link OAuth |
| `POST` | `/api/v1/calendar/microsoft/connect` | Accepts optional `{ redirectUri }` for native deep-link OAuth |

### Reused backend surfaces

- `GET /api/v1/notifications`
- `PATCH /api/v1/notifications/:id/read`
- `POST /api/v1/notifications/read-all`
- `GET /api/v1/recommendations/profile`
- `POST /api/v1/recommendations/profile`
- `POST /api/v1/calendar/connections/:id/sync`
- `DELETE /api/v1/calendar/connections/:id`

## Mobile flow summary

### Today

- Loads `GET /today`
- Shows premium loading, error, no-calendar, initial-sync, empty-day, and live timeline states
- Displays both calendar events and free windows in one coherent schedule view
- Offers in-context calendar connection if no provider is connected

### Calendar connection

1. Mobile app builds a native deep-link redirect URI with Expo Auth Session
2. App calls `POST /calendar/{provider}/connect` with `{ redirectUri }`
3. Browser session opens provider consent screen
4. Provider redirects back into the app via deep link with `code` and `state`
5. App completes the connection with `GET /calendar/{provider}/callback`
6. App immediately triggers `POST /calendar/connections/:id/sync`

This keeps the existing server-side OAuth state and token storage model, while making the handoff mobile-native.

### Settings

Settings now combine:

- account profile and app-level preferences from `/me`
- recommendation preference profile from `/recommendations/profile`
- calendar connection controls from the existing calendar APIs

### Notifications

- Notification center uses the existing persisted notifications backend
- Unread state is surfaced both in the bell indicator and the notification list
- Individual notifications can be marked read
- Entire inbox can be marked read at once

## Testing

New tests added for:

- Today aggregation and live schedule response mapping
- user/settings preference normalization and updates
- mobile calendar redirect handoff support in the connection service

Existing notification service tests continue to cover unread filtering, mark-as-read, and mark-all-read behavior.

## Prompt 7 boundary

Prompt 6 intentionally stops short of broader operational/admin work. Good Prompt 7 candidates are:

- richer notification deep-linking and real-time delivery
- push notification delivery (APNs / FCM)
- user-managed notification preference granularity by type
- richer Today intelligence such as travel-time, location-awareness, and multi-day briefing
- executive profile enrichment beyond the practical first settings pass
- admin-side shell completion and live operational dashboards
