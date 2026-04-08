# ADR-010: Requests & Notifications Architecture (Phase 5)

**Status:** Accepted
**Date:** 2026-04-08
**Deciders:** Engineering

---

## Context

Phase 5 turns the product from "context-aware and conversational" into "operationally executable". A foreign executive should be able to move from a recommendation or conversation into a tracked concierge request with clear status, ownership, and update history.

---

## Decisions

### 1. Request persistence model

**Decision:** Use the existing `ConciergeRequest` + `RequestStatusUpdate` Prisma models without schema changes. Every status transition creates a new `RequestStatusUpdate` record — the current status is never silently overwritten.

**Rationale:**
- The models were designed for this in prior phases (Prisma schema includes all required fields).
- Immutable status history is essential for concierge accountability (the team can reconstruct exactly what happened and when).

**Rule:** Any endpoint that changes `status` must also call `prisma.requestStatusUpdate.create()` in the same transaction. The `RequestWorkflowService` enforces this.

---

### 2. Request creation sources

**Decision:** Support three creation paths with a single underlying service:

| Source | Endpoint | Notes |
|--------|----------|-------|
| Direct user action | `POST /concierge-requests` | Free-form title + description |
| Recommendation CTA | `POST /concierge-requests/from-recommendation` | Passes `catalogItemId`, links `sourceRecommendationId` |
| Conversation link | Either endpoint + `conversationId` | Links to the originating conversation thread |

**Rationale:** Keeping all paths through one service avoids status/history duplication. The `sourceRecommendationId` and `conversationId` are optional foreign keys — they add context without requiring them.

---

### 3. Admin/agent request access separation

**Decision:** Add `AdminRequestController` at `/admin/requests` alongside the existing `ConciergeRequestController` at `/concierge-requests`.

**Agent queue rule:**
- `CONCIERGE_AGENT` sees all requests with status `PENDING`, `ACKNOWLEDGED`, or `IN_PROGRESS` (open queue) plus any request assigned to them (for history/continuity).
- `ADMIN` sees all requests regardless of status.

**Self-assign rule:**
- `CONCIERGE_AGENT` may only assign themselves (`dto.agentId === user.id`).
- `ADMIN` may assign any agent.

**Rationale:** Agents need to see the full open queue (not just their assigned requests) to pick up work. Restricting self-assign prevents rogue reassignments.

---

### 4. Notification architecture

**Decision:** Phase 5 delivers in-app stored notifications only. The `Notification` model (persisted in Postgres) is the source of truth. APNs/FCM delivery via `PushToken` is architecturally prepared but not wired in this phase.

**Events that generate notifications:**
| Event | Type | Recipient |
|-------|------|-----------|
| Request acknowledged | REQUEST_UPDATE | Executive |
| Request status changed | REQUEST_UPDATE | Executive |
| Agent assigned | REQUEST_UPDATE | Executive |
| Human handoff initiated | MESSAGE | Executive |

**Rationale:** Stored in-app notifications provide the full feature with zero external service dependencies. Push delivery can be layered on top in Phase 6 by adding FCM logic to the existing `NotificationService`.

---

### 5. Recommendation-to-request bridge

**Decision:** The mobile "Request this" CTA opens an inline sheet pre-filled with the recommendation context. On confirm, it calls `POST /concierge-requests/from-recommendation` with:
- `catalogItemId` — the catalog item
- `title` — `"Book: {rec.title}"`
- `description` — the user's optional message or the recommendation summary
- `timeWindowContext` — from `rec.suitableWindows` if available

After a successful request, the feedback action `ACTED` is sent to `POST /recommendations/feedback` so the recommendation ranking system learns the user took action.

**Rationale:** This closes the loop between discovery (recommendations) and execution (requests) in the fewest API calls, while preserving full recommendation analytics.

---

### 6. No schema changes

**Decision:** Phase 5 introduces zero Prisma schema migrations.

**Rationale:**
- All required models (`ConciergeRequest`, `RequestStatusUpdate`, `Notification`, `PushToken`) were designed and included in the schema during Phase 0/1.
- Running migrations in a feature phase risks data integrity issues and deployment complexity.

---

## API Surface (Phase 5 additions)

| Method | Path | Roles |
|--------|------|-------|
| GET | `/api/v1/admin/requests` | CONCIERGE_AGENT, ADMIN |
| GET | `/api/v1/admin/requests/:id` | CONCIERGE_AGENT (scoped), ADMIN |
| PATCH | `/api/v1/admin/requests/:id/status` | CONCIERGE_AGENT (scoped), ADMIN |
| POST | `/api/v1/admin/requests/:id/assign` | CONCIERGE_AGENT (self only), ADMIN |

Existing endpoints remain unchanged (no breaking changes).

---

## What belongs to Phase 6

- APNs/FCM push delivery via `PushToken`
- Push token registration endpoint (`POST /push-tokens`)
- Real-time status updates (WebSocket or SSE)
- Request cancellation by the user
- Admin dashboard live stats (real KPIs replacing mock data)
- Agent workload view and reassignment queue
- Notification preferences (opt-in/opt-out per type)
