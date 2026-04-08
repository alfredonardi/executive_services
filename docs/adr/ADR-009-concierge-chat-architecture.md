# ADR-009: Concierge Chat Architecture (Phase 4)

**Status:** Accepted
**Date:** 2026-04-07
**Deciders:** Engineering

---

## Context

Phase 4 introduces the first real concierge conversation layer. Prior to this phase the mobile Concierge tab was mock-only (a `setTimeout` stub). The goal is to turn it into a persisted, context-aware, AI-assisted chat system with human handoff capability.

---

## Decisions

### 1. Conversation persistence model

**Decision:** Use the existing `Conversation` and `Message` Prisma models as the sole persistence base for chat history.

**Rationale:**
- Models already include `ConversationStatus` enum (ACTIVE, HUMAN_HANDOFF, RESOLVED, ARCHIVED), `MessageRole` enum (USER, AI, AGENT), and all necessary foreign keys.
- Adding a separate "chat" table would duplicate structure.

**Trade-offs:** The `context` JSON field on `Conversation` is available for future storage of conversation-level metadata but is not written in Phase 4.

---

### 2. Context assembly via ContextAssemblyService

**Decision:** Introduce a dedicated `ContextAssemblyService` inside the `ConciergeModule` that assembles normalized AI context from:
- User identity and preferences (`prisma.user`, `prisma.preferenceProfile`)
- Today's calendar events (`CalendarEventService`)
- Last recommendation session snapshot (`prisma.recommendationSession`)

**Rationale:**
- Keeping context assembly in one place avoids scattering prompt-building logic across controllers and services.
- Using Prisma directly for user/profile queries (rather than importing `PreferenceProfileService` from `RecommendationModule`) avoids tight module coupling.
- Using the last `resultsSnapshot` instead of re-running the full ranking pipeline keeps latency low for chat replies.

**Trade-offs:**
- The recommendation snapshot can be stale (up to 24h if the user hasn't refreshed). This is acceptable for chat context — Phase 5 may trigger a fresh recommendation run when context is needed.
- Calendar context queries are lightweight (last 50 events for the current day).

**Privacy:** `renderForPrompt` outputs a normalized text summary. Raw event objects, user IDs, and database fields are never included in prompts.

---

### 3. Handoff trigger model

**Decision:** Handoff is triggered either explicitly by the user (via `POST /conversations/:id/handoff`) or suggested by the AI when it detects that a concrete action is needed (the AI appends `[SUGGEST_HANDOFF]` to its reply). The client surface receives `shouldSuggestHandoff: true` and may prompt the user.

**Rationale:**
- Keeping handoff explicit prevents silent escalations and ensures the user is always informed.
- The AI-suggested handoff is surfaced as a signal, not an automatic trigger — the user confirms.
- `[SUGGEST_HANDOFF]` is stripped from the displayed AI reply before storage.

**Trade-offs:** An automatic handoff trigger would be faster, but risks surprising users who did not request it.

---

### 4. Admin/agent conversation access separation

**Decision:** Create a separate `AdminConversationController` under `/admin/conversations` rather than extending the existing user-facing `ConversationController`.

**Rationale:**
- The agent and admin access patterns differ significantly from user access (role-scoped list, reply-as-agent, auto-assign).
- A separate controller keeps role boundaries explicit and prevents accidental privilege escalation.

**Agent access rule:**
- `CONCIERGE_AGENT` can read any conversation with status `HUMAN_HANDOFF`, or any conversation assigned to them.
- `ADMIN` can read all conversations.

---

### 5. Non-streaming AI replies

**Decision:** Phase 4 uses non-streaming AI responses.

**Rationale:**
- Streaming requires a persistent HTTP connection or WebSocket, and adds significant mobile complexity (streaming SSE parsing, partial message state management).
- Non-streaming provides a simpler, more testable path and is sufficient for Phase 4.

**Follow-up:** Streaming can be added in Phase 5 or as a standalone spike. `AiService.chatStream()` already exists; only the transport layer needs to be added.

---

### 6. Mobile conversation lifecycle

**Decision:** On mount, the mobile Concierge screen loads the most recent ACTIVE or HUMAN_HANDOFF conversation. If none exists, it creates one. The `conversationId` is held in React state (not persisted to SecureStore).

**Rationale:**
- SecureStore persistence of a conversation ID adds complexity (stale conversations, deleted-user edge cases).
- Loading via `GET /conversations` on mount is fast and always correct.

**Trade-offs:** If the user force-quits and reopens the app, the screen must re-fetch — but will correctly resume the active conversation.

---

## API Surface (Phase 4)

| Method | Path | Roles |
|--------|------|-------|
| POST | `/api/v1/conversations` | EXECUTIVE |
| GET | `/api/v1/conversations` | EXECUTIVE |
| GET | `/api/v1/conversations/:id` | EXECUTIVE (owner) |
| POST | `/api/v1/conversations/:id/messages` | EXECUTIVE (owner) |
| POST | `/api/v1/conversations/:id/handoff` | EXECUTIVE (owner) |
| POST | `/api/v1/conversations/:id/assign` | CONCIERGE_AGENT, ADMIN |
| GET | `/api/v1/admin/conversations` | CONCIERGE_AGENT, ADMIN |
| GET | `/api/v1/admin/conversations/:id` | CONCIERGE_AGENT (scoped), ADMIN |
| POST | `/api/v1/admin/conversations/:id/messages` | CONCIERGE_AGENT (scoped), ADMIN |

---

## What belongs to Phase 5

- Formal request workflow triggered from conversation (ConciergeRequest linking)
- Push notifications for new agent messages
- Streaming AI responses
- Admin-side conversation search and filtering by user
- Agent-side conversation dashboard with real-time updates
- Conversation archival and resolution workflow
- Admin token/auth layer for the admin panel
