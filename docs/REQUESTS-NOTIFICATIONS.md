# Requests & Notifications — Phase 5

This document covers the architecture, request lifecycle, notification behavior, recommendation-to-request flow, API endpoints, and known limitations for the Phase 5 implementation.

---

## Overview

Phase 5 makes the product operationally executable. An executive can move from a recommendation or conversation into a tracked concierge request with persisted status history, agent assignment, and in-app notifications for every meaningful event.

---

## Module structure

```
apps/api/src/modules/concierge/
├── controllers/
│   ├── concierge-request.controller.ts      # User-facing request endpoints
│   ├── admin-request.controller.ts          # Agent/admin queue endpoints (NEW Phase 5)
│   ├── notification.controller.ts           # User notification endpoints
│   ├── conversation.controller.ts
│   └── admin-conversation.controller.ts
├── services/
│   ├── concierge-request.service.ts         # Request CRUD, access control
│   ├── request-workflow.service.ts          # Status transitions + notifications
│   ├── notification.service.ts              # Notification persistence + templates
│   ├── conversation.service.ts
│   ├── message.service.ts
│   ├── ai-assistant.service.ts
│   ├── context-assembly.service.ts
│   └── handoff.service.ts
└── __tests__/
    ├── admin-request.controller.spec.ts     # NEW Phase 5
    ├── concierge-request.service.spec.ts
    ├── concierge-request.controller.spec.ts
    ├── request-workflow.service.spec.ts
    └── notification.service.spec.ts
```

---

## Request lifecycle

```
PENDING → ACKNOWLEDGED → IN_PROGRESS → COMPLETED
                  ↓
             CANCELLED
```

Every transition creates a `RequestStatusUpdate` record atomically with the status change. The current status is never silently overwritten.

### Status meanings

| Status | Meaning |
|--------|---------|
| PENDING | Just created, awaiting agent acknowledgement |
| ACKNOWLEDGED | Agent has seen and acknowledged the request |
| IN_PROGRESS | Agent is actively working on it |
| COMPLETED | Request fulfilled |
| CANCELLED | Request cancelled (by agent or admin) |

---

## API endpoints

### User (EXECUTIVE role)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/concierge-requests` | Create a request directly |
| POST | `/api/v1/concierge-requests/from-recommendation` | Create from recommendation CTA |
| GET | `/api/v1/concierge-requests` | List own requests |
| GET | `/api/v1/concierge-requests/:id` | Request detail with status history |

### Notification (EXECUTIVE role)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/notifications` | List notifications (optional `?unreadOnly=true`) |
| PATCH | `/api/v1/notifications/:id/read` | Mark notification as read |
| POST | `/api/v1/notifications/read-all` | Mark all as read |

### Agent / Admin

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/admin/requests` | Open queue + assigned history |
| GET | `/api/v1/admin/requests/:id` | Full detail + status history |
| PATCH | `/api/v1/admin/requests/:id/status` | Update status |
| POST | `/api/v1/admin/requests/:id/assign` | Assign agent |

---

## Access control

| Role | Access |
|------|--------|
| EXECUTIVE | Own requests only; own notifications only |
| CONCIERGE_AGENT | Open queue (PENDING/ACKNOWLEDGED/IN_PROGRESS) + assigned requests; self-assign only |
| ADMIN | All requests; can assign any agent |

---

## Request creation sources

### 1. Direct creation
```
POST /concierge-requests
{ title, description, priority?, category?, dueAt?, conversationId? }
```

### 2. From recommendation
```
POST /concierge-requests/from-recommendation
{ catalogItemId, title, description, priority?, timeWindowContext?, conversationId? }
```
Sets `sourceRecommendationId = catalogItemId`. The `timeWindowContext` is appended to the description.

### 3. From conversation
Either endpoint can receive a `conversationId` to link the request to a conversation thread. The conversation remains in its current state — this is a reference, not a state change.

---

## Recommendation-to-request bridge

1. User opens the For You screen → recommendations are fetched from `/recommendations`
2. User taps "Request this" → a sheet opens pre-filled with the recommendation's title and summary
3. User optionally adds a message → taps "Submit to Concierge"
4. `POST /concierge-requests/from-recommendation` is called with `catalogItemId`, title, description, and `timeWindowContext` from `suitableWindows`
5. On success, `POST /recommendations/feedback` is called with `action=ACTED` to close the analytics loop
6. The card shows "✓ Request submitted to your concierge"

Save and Dismiss buttons:
- **Save** → `POST /recommendations/feedback` with `action=SAVED` — card shows confirmation
- **Dismiss** → `POST /recommendations/feedback` with `action=DISMISSED` — card is removed from list

---

## Notification behavior

Notifications are persisted in the `Notification` table. They are available via `GET /notifications`.

| Event | Type | Title template |
|-------|------|----------------|
| Request created | REQUEST_UPDATE | "Request received — {title}" |
| Request acknowledged | REQUEST_UPDATE | "Request acknowledged — {title}" |
| Request status changed | REQUEST_UPDATE | "Request update — {title}" |
| Agent assigned | REQUEST_UPDATE | "Concierge assigned — {title}" |
| Human handoff initiated | MESSAGE | "A concierge agent will assist you" |

**In-app only:** Notifications are stored records. APNs/FCM push delivery is prepared (PushToken model exists) but not wired in Phase 5.

---

## Mobile integration

### Requests tab (`requests.tsx`)
- Loads real requests from `GET /concierge-requests` on mount
- Pull-to-refresh supported
- Active requests (PENDING/ACKNOWLEDGED/IN_PROGRESS) shown in "ACTIVE" section
- Completed/cancelled in "COMPLETED" section
- Tap card → detail sheet with status history timeline
- "+ New" → create request sheet with title + description fields

### For You tab (`recommendations.tsx`)
- Loads real recommendations from `GET /recommendations`
- "Request this" → opens pre-filled sheet → `POST /concierge-requests/from-recommendation`
- "Save" → `POST /recommendations/feedback { action: 'SAVED' }` → confirmation shown
- "Dismiss" → `POST /recommendations/feedback { action: 'DISMISSED' }` → card removed

---

## Admin interface

### `/requests` (list page)
- Filter tabs: All / Pending / In Progress / Completed
- Columns: Request title + category chip, Client (name + company), Status badge, Priority, Assigned agent, Updated

### `/requests/[id]` (detail page)
- Request description
- Status history timeline (color-coded dots)
- Linked conversation link (if present)
- Sidebar: client info, timeline dates, agent assignment form, status update form

---

## Known limitations and Phase 6 scope

| Item | Notes |
|------|-------|
| Push notifications | PushToken model exists; FCM/APNs delivery not wired |
| Request cancellation by user | Users cannot cancel — agent/admin only |
| Real-time status updates on mobile | Polling only (pull-to-refresh) |
| Admin dashboard live KPIs | Dashboard still uses mock stats |
| Notification preferences | No opt-in/opt-out per type |
| Agent workload dashboard | No aggregate view of agent load |
