# ADR-006: Calendar Integration Architecture

**Date:** 2026-04-07  
**Status:** Accepted  
**Deciders:** Tech Lead

---

## Context

Executive users need to connect their Google Calendar and Microsoft Outlook Calendar to the app. The system must:
- Allow secure OAuth-based connection with explicit user consent
- Ingest upcoming events into a normalized internal model
- Expose calendar data to AI-powered concierge features
- Handle provider failures, token expiry, and revocation gracefully
- Keep business logic completely independent from provider-specific schemas

## Decision

**Provider adapter pattern with a shared ICalendarProvider interface, normalized domain model, and read-only pull sync with incremental cursors.**

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   CalendarModule                         │
│                                                          │
│  CalendarController ──► CalendarConnectionService        │
│                    ──► CalendarSyncService               │
│                    ──► CalendarEventService              │
│                                                          │
│  CalendarSyncWorker (cron @30min) ──► CalendarSyncService│
│                                                          │
│  CalendarConnectionService ──► ICalendarProvider         │
│                               ├── GoogleCalendarProvider │
│                               └── MicrosoftCalProvider   │
│                                                          │
│  CalendarSyncService ──► ICalendarProvider               │
│                    ──► EncryptionService (token decrypt)  │
└─────────────────────────────────────────────────────────┘
```

### ICalendarProvider Interface

All provider-specific code lives behind `ICalendarProvider`. This interface exposes:
- `getAuthorizationUrl()` — OAuth initiation
- `exchangeCodeForTokens()` — code → token exchange
- `refreshAccessToken()` — token refresh
- `fetchEvents()` — event ingestion
- `fetchAccountInfo()` — post-OAuth account info

No business logic depends on Google- or Microsoft-specific types. The `NormalizedCalendarEvent` model is the only calendar event type used in services and endpoints.

### OAuth Flow

1. Client calls `POST /calendar/{provider}/connect`
2. Server generates PKCE verifier + challenge, state token, stores `OAuthState` in DB (TTL: 10 min)
3. Server returns `authorizationUrl` with state + code_challenge
4. Client redirects user to provider OAuth consent page
5. Provider redirects to `GET /calendar/{provider}/callback?code=...&state=...`
6. Server validates state (prevents CSRF), validates OAuthState not yet used (prevents replay)
7. Server exchanges code for tokens using PKCE verifier
8. Server fetches account info, stores encrypted tokens in `CalendarConnection`
9. Server triggers initial sync

### Sync Strategy (Phase 2: Read-Only)

- **Full sync** on first connection (time window: 7 days past → 60 days future)
- **Incremental sync** on subsequent runs using provider-native cursors:
  - Google: `nextSyncToken` from Events.list
  - Microsoft: `deltaLink` from calendarView/delta
- **Fallback** to full sync when cursor expires (provider returns 410)
- **Scheduled**: every 30 minutes via `@nestjs/schedule` cron job
- **On-demand**: triggered by user via `POST /calendar/connections/:id/sync`
- **Audited**: every sync creates a `CalendarSyncAttempt` record

### Bidirectional Sync (Deferred)

Write-back to provider calendars is explicitly out of scope for Phase 2. The internal model is designed to be extensible for future write operations. This decision avoids introducing conflicts, data ownership questions, and complex merge logic during the MVP phase.

### Webhook Push (Deferred)

Both Google (push channels) and Microsoft (Graph subscriptions) support near-real-time push notifications. These are deferred to Phase 3 to keep the MVP sync architecture simple. The 30-minute polling cadence is acceptable for the current use case (concierge agenda awareness, not real-time scheduling).

## Rationale

- **Provider adapter pattern**: isolates business logic from provider churn; adding a new provider requires only a new adapter class
- **PKCE for all providers**: prevents authorization code interception even for server-side flows
- **Incremental sync with cursors**: reduces provider API quota consumption significantly after the first sync
- **Read-only first**: eliminates risk of accidental data modification in user calendars
- **Normalized model**: AI and concierge features work against a stable internal schema

## Alternatives Considered

- **Webhook-first sync**: more responsive but requires HTTPS endpoint registration, renewal, and security validation of incoming webhooks. Deferred.
- **Direct SDK use (googleapis, @microsoft/microsoft-graph-client)**: adds significant bundle size and abstraction layers. Raw OAuth + fetch provides more control and testability.
- **Unified OAuth provider (e.g., Nylas)**: reduces integration code but adds external dependency and cost. Rejected for MVP.

## Consequences

- Adding a new calendar provider requires implementing `ICalendarProvider` and registering it in `CalendarModule`
- Multi-calendar per user is supported by the schema (`@@unique([userId, provider])` allows one connection per provider, multiple providers per user)
- Scheduled sync in a single instance is fine for MVP; horizontal scaling requires a distributed lock (Redis SETNX) — a known gap
- Token encryption key rotation requires a data migration job — must be planned before changing `FIELD_ENCRYPTION_KEY`
