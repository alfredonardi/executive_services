# Calendar Integration — Technical Guide

## Overview

This document describes the design and implementation of the Google Calendar and Microsoft Outlook Calendar integrations for Executive Concierge SP.

The integration is built around these principles:
- **Provider-agnostic**: business logic depends on `ICalendarProvider` and `NormalizedCalendarEvent`, never on Google- or Microsoft-specific schemas
- **Security-first**: OAuth 2.0 + PKCE, encrypted token storage, audit trail for every sensitive operation
- **Read-only (Phase 2)**: events are pulled from providers; no write-back to provider calendars
- **Reliable**: incremental sync with automatic full-sync fallback, retry with exponential backoff, explicit failure tracking

---

## API Endpoints

All endpoints require `Authorization: Bearer <access_token>` (JWT from login).

### Connection Management

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/calendar/connections` | List active calendar connections |
| `POST` | `/api/v1/calendar/google/connect` | Initiate Google Calendar OAuth (`{ redirectUri? }` supported for mobile deep links) |
| `GET` | `/api/v1/calendar/google/callback` | Google OAuth callback (redirect) |
| `POST` | `/api/v1/calendar/microsoft/connect` | Initiate Microsoft Calendar OAuth (`{ redirectUri? }` supported for mobile deep links) |
| `GET` | `/api/v1/calendar/microsoft/callback` | Microsoft OAuth callback (redirect) |
| `DELETE` | `/api/v1/calendar/connections/:id` | Disconnect a calendar |

### Events

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/calendar/events` | Get normalized events (all providers) |

Query params: `from` (ISO 8601), `to` (ISO 8601), `limit` (max 200), `provider` (GOOGLE/MICROSOFT)

### Sync

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/calendar/connections/:id/sync` | Trigger manual sync (async) |
| `GET` | `/api/v1/calendar/status` | Sync status for all connections |

---

## OAuth Connection Flow

### Mobile App Flow (recommended)

```
Mobile App                   API                      Google/Microsoft
    │                         │                               │
    │  POST /calendar/google/connect { redirectUri }          │
    │ ────────────────────────►                               │
    │                         │  Creates OAuthState (PKCE)   │
    │  { authorizationUrl, state }                            │
    │ ◄────────────────────────                               │
    │                         │                               │
    │  Open browser/webview to authorizationUrl               │
    │ ───────────────────────────────────────────────────────►│
    │                         │                               │
    │                         │                   User consents
    │                         │                               │
    │                         │  Redirect to callback URL     │
    │                         │ ◄─────────────────────────────│
    │                         │                               │
    │  callback returns code+state to the app via deep link   │
    │                         │                               │
    │  App calls /calendar/google/callback?code=...&state=... │
    │ ────────────────────────►                               │
    │                         │  Validates state (CSRF check)  │
    │                         │  Exchanges code (PKCE verify) │
    │                         │  Fetches account info         │
    │                         │  Stores encrypted tokens      │
    │  { connectionId, provider, email }                      │
    │ ◄────────────────────────                               │
    │                         │                               │
    │  POST /calendar/connections/:id/sync                    │
    │ ────────────────────────►                               │
```

### PKCE Details

- `code_verifier`: 48 random bytes, base64url-encoded (72-char string)
- `code_challenge`: SHA-256 of verifier, base64url-encoded
- `state`: 32 random bytes, hex-encoded
- Both stored server-side in `OAuthState` with a 10-minute TTL
- State is marked as `usedAt` immediately upon callback receipt (replay prevention)

---

## Token Storage

Tokens are stored encrypted in `calendar_connections`:

```sql
access_token  VARCHAR  -- AES-256-GCM encrypted, format: iv:authTag:ciphertext (base64)
refresh_token VARCHAR  -- Same format
```

See [ADR-007](./adr/ADR-007-token-encryption.md) for encryption details.

**Key rules:**
- Tokens are decrypted only in memory, for the duration of an API call
- Decrypted tokens are never logged
- `accessToken` is refreshed automatically when within 5 minutes of expiry

---

## Sync Architecture

### Schedule

The `CalendarSyncWorker` runs every 30 minutes via `@nestjs/schedule` cron:

```
@Cron(CronExpression.EVERY_30_MINUTES)
async runScheduledSync()
```

It iterates all active connections sequentially (not parallel) to be conservative with provider rate limits.

### Sync Types

**Full sync** (first connection, or after cursor expiry):
- Fetches all events within `[now - 7 days, now + 60 days]`
- Google: `calendar.events.list` with `timeMin`/`timeMax`
- Microsoft: `me/calendarView` with `startDateTime`/`endDateTime` + initializes delta query

**Incremental sync** (subsequent runs with valid cursor):
- Google: `calendar.events.list?syncToken=<cursor>` → returns only changed events
- Microsoft: uses `deltaLink` URL from previous sync

**Cursor expiry (410 Gone)**:
- Provider returns 410 when the cursor is too old
- System resets cursor (`syncCursor = null`) and performs a full sync

### Event Persistence

Events are upserted by `(connectionId, externalId)`:
- **New**: `INSERT INTO calendar_events`
- **Updated**: `UPDATE calendar_events SET ...`
- **Cancelled**: `UPDATE calendar_events SET is_cancelled = true`

Cancelled events that were never in the database are silently skipped.

### Retry Strategy

Provider calls are retried up to 3 times with exponential backoff:
```
Attempt 1: immediate
Attempt 2: wait 2s
Attempt 3: wait 4s
Attempt 4: wait 8s → fail
```

**Non-retryable errors**:
- `ProviderTokenRevokedError` (token has been revoked by user) → marks connection inactive
- `ProviderTransientError` with status 410 (cursor expired) → triggers full sync fallback

### Failure Tracking

Every sync run creates a `CalendarSyncAttempt` record:

```sql
status        IN_PROGRESS | COMPLETED | FAILED | PARTIAL
events_added
events_updated
events_removed
error_message
duration_ms
triggered_by  "scheduler" | "user" | "connection"
```

---

## Normalized Domain Model

All calendar data is normalized to `NormalizedCalendarEvent` before persistence:

```typescript
interface NormalizedCalendarEvent {
  externalId: string;        // provider-assigned ID
  title: string;             // max 255 chars, sanitized
  description: string | null; // max 2000 chars
  startAt: Date;
  endAt: Date;
  timezone: string | null;  // IANA timezone
  isAllDay: boolean;
  location: string | null;  // max 500 chars
  meetingUrl: string | null; // first video conference URL found
  organizer: string | null;  // organizer email
  attendees: NormalizedAttendee[];
  isCancelled: boolean;
  raw: Record<string, unknown>; // stored for debugging, NEVER exposed to clients
}
```

The `raw` field contains the original provider payload. It is stored in the database for debugging purposes but is never returned in any API response.

---

## Security Decisions

| Decision | Rationale |
|----------|-----------|
| PKCE for all providers | Prevents authorization code interception; required even for confidential clients |
| State token for CSRF prevention | One-time use, 10-minute TTL, stored server-side |
| AES-256-GCM token encryption | Authenticated encryption prevents tampered tokens from being decrypted |
| 5-minute access token refresh buffer | Prevents mid-operation failures due to token expiry |
| Best-effort token revocation on disconnect | Reduces risk even when revocation is not 100% reliable |
| Audit log for every sensitive calendar operation | Supports compliance, incident investigation, and anomaly detection |
| `raw` field never exposed in API | Provider-specific metadata may contain PII not covered by the app's data policy |

---

## Provider-Specific Notes

### Google Calendar

- Authorization: `accounts.google.com/o/oauth2/v2/auth`
- Token endpoint: `oauth2.googleapis.com/token`
- Events: `www.googleapis.com/calendar/v3/calendars/primary/events`
- Incremental sync: `nextSyncToken` (reset on 410 Gone)
- `prompt=consent` forced to always receive a `refresh_token`
- `access_type=offline` required for refresh tokens

### Microsoft / Outlook

- Authorization: `login.microsoftonline.com/common/oauth2/v2.0/authorize` (multi-tenant)
- Token endpoint: `login.microsoftonline.com/common/oauth2/v2.0/token`
- Events: `graph.microsoft.com/v1.0/me/calendarView` (initial) + delta query (incremental)
- Incremental sync: `@odata.deltaLink` URL (full URL returned by Graph API)
- `offline_access` scope required for refresh tokens
- Tenant ID extracted from ID token JWT (no DB roundtrip needed)
- May not return a new `refresh_token` on refresh — keep the existing one

---

## Observability

The following are logged at each stage:

| Event | Level | Data logged (NO tokens or PII) |
|-------|-------|-------------------------------|
| OAuth flow initiated | LOG | userId, provider |
| OAuth callback received | LOG | state (opaque) |
| Calendar connected | LOG | userId, provider, email (account email) |
| Token refreshed | LOG | connectionId, provider |
| Token refresh failed | WARN | connectionId, provider, error class |
| Sync started | LOG | connectionId, triggeredBy |
| Sync completed | LOG | connectionId, +added, ~updated, -removed, durationMs |
| Sync failed | ERROR | connectionId, error class+message |
| Connection deactivated (token revoked) | WARN | connectionId |

All events create an `AuditLog` record for compliance.

---

## Known Gaps and Deferred Work

| Gap | Phase |
|-----|-------|
| Webhook push sync (Google push channels, MS Graph subscriptions) | Phase 3 |
| Bidirectional sync (write events back to provider) | Phase 3+ |
| Distributed lock for multi-instance sync worker | Pre-scaling |
| KMS envelope encryption for token key | Phase 3 |
| Per-calendar selection (vs. always using primary) | Phase 3 |
| Error notification to user on persistent sync failure | Phase 3 |
| Rate limit handling with Retry-After header | Phase 3 |
