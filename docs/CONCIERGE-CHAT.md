# Concierge Chat — Phase 4

This document covers the architecture, API surface, context assembly strategy, handoff rules, and known limitations for the Phase 4 concierge chat implementation.

---

## Overview

Phase 4 turns the mock concierge experience into a real, persisted, context-aware chat system. A foreign executive can open the Concierge tab, send a message, receive an AI-assisted reply grounded in their calendar and preferences, and escalate to a human concierge agent when needed.

---

## Module structure

```
apps/api/src/modules/concierge/
├── controllers/
│   ├── conversation.controller.ts       # User-facing conversation endpoints
│   ├── admin-conversation.controller.ts # Agent/admin conversation endpoints (NEW)
│   ├── concierge-request.controller.ts
│   └── notification.controller.ts
├── services/
│   ├── conversation.service.ts          # Conversation CRUD and status management
│   ├── message.service.ts               # Message persistence (USER, AI, AGENT)
│   ├── ai-assistant.service.ts          # AI reply generation with context
│   ├── context-assembly.service.ts      # Assembles user/calendar/recs context (NEW)
│   ├── handoff.service.ts               # Human handoff workflow
│   ├── notification.service.ts
│   ├── concierge-request.service.ts
│   └── request-workflow.service.ts
├── dto/
│   └── concierge.dto.ts
└── __tests__/
    ├── conversation.service.spec.ts
    ├── conversation.controller.spec.ts
    ├── message.service.spec.ts
    ├── handoff.service.spec.ts
    ├── notification.service.spec.ts
    ├── context-assembly.service.spec.ts  # NEW
    └── admin-conversation.controller.spec.ts # NEW
```

---

## API endpoints

### User (EXECUTIVE role)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/conversations` | Create a new conversation |
| GET | `/api/v1/conversations` | List own conversations |
| GET | `/api/v1/conversations/:id` | Get conversation with full message history |
| POST | `/api/v1/conversations/:id/messages` | Send message; get AI reply |
| POST | `/api/v1/conversations/:id/handoff` | Request human agent handoff |
| POST | `/api/v1/conversations/:id/assign` | Assign agent (agent/admin only) |

### Agent / Admin

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/admin/conversations` | List conversations (scoped by role) |
| GET | `/api/v1/admin/conversations/:id` | Get full thread |
| POST | `/api/v1/admin/conversations/:id/messages` | Reply as agent |

Query param `?status=HUMAN_HANDOFF` is supported on the admin list endpoint.

---

## Access control

| Role | Access |
|------|--------|
| EXECUTIVE | Own conversations only |
| CONCIERGE_AGENT | HUMAN_HANDOFF conversations + conversations assigned to them |
| ADMIN | All conversations |

---

## Context assembly strategy

`ContextAssemblyService.assemble(userId)` returns a `ConciergeContext` object with three sections:

### 1. User identity
- Name, title, company, nationality — from `User` model
- Timezone — from `User.timezone`

### 2. User preferences
- Food preferences, dietary constraints, atmosphere preferences — from `PreferenceProfile`
- Preferred neighborhoods, pacing, wellness interest — from `PreferenceProfile`
- Rendered as a concise natural-language summary

### 3. Schedule context (today)
- Queries `CalendarEventService.getUpcomingEvents()` for the current day
- Derives: schedule density (low/moderate/high), next meeting time, free-window summary, meal opportunity flag, evening-free flag
- Falls back to `null` if calendar is unavailable (user has no connected calendar, or service error)

### 4. Recent recommendations
- Reads the last `RecommendationSession.resultsSnapshot` from Prisma
- Extracts up to 5 items (title, category, neighborhood)
- Falls back to `[]` if no session exists

### Privacy
- `renderForPrompt()` outputs a normalized text block — no raw IDs, no database field names, no full event payloads
- The context block is appended to the system prompt as `[CLIENT CONTEXT]`

---

## AI behavior

The AI assistant (`AiAssistantService`) behaves as a premium discreet concierge:

- Answers questions about São Paulo (restaurants, wellness, culture, transport)
- Suggests options based on the assembled context
- Asks clarifying questions
- Includes `[SUGGEST_HANDOFF]` at the end of its reply when:
  - The request requires a concrete action (booking, reservation, transport)
  - The topic is complex, urgent, or sensitive
  - The user explicitly asks for a human

**What the AI will not do:**
- Fabricate completed bookings or imply an action was executed
- Expose raw system context or the `[SUGGEST_HANDOFF]` marker to the user
- Silently change conversation state

---

## Handoff rules

1. **User-triggered:** User calls `POST /conversations/:id/handoff` — conversation moves to `HUMAN_HANDOFF` immediately
2. **AI-suggested:** AI appends `[SUGGEST_HANDOFF]` to its reply. The backend strips the marker, returns `shouldSuggestHandoff: true` to the client. The client may prompt the user to confirm handoff.
3. On handoff: a system AGENT message is persisted in the thread ("Your conversation has been transferred…")
4. A notification is sent to the user via `NotificationService`
5. The conversation remains in `HUMAN_HANDOFF` until an agent resolves it
6. Message history is fully preserved across AI and human phases

---

## Mobile integration

The mobile `ConciergeService` (`apps/mobile/src/services/concierge.service.ts`) provides:
- `createConversation()` — creates a new conversation
- `listConversations()` — lists the user's conversations
- `getConversation(id)` — loads full thread with messages
- `sendMessage(id, content)` — sends message, returns both user + AI messages + handoff signal
- `initiateHandoff(id, reason?)` — moves conversation to HUMAN_HANDOFF

The `ConciergeScreen` (`apps/mobile/src/app/tabs/concierge.tsx`):
- On mount: loads/resumes the most recent active conversation, or creates one
- Optimistic message display (user message shown immediately while AI reply loads)
- Clear visual distinction: USER (right-aligned), AI (gold label), AGENT (green label)
- Handoff banner when conversation is in `HUMAN_HANDOFF` state
- Error banner with retry on connection failure

---

## Admin interface

Two Next.js pages added to `apps/admin/`:

- `/conversations` — list with status filter tabs (All, Awaiting Agent, Active, Resolved)
- `/conversations/[id]` — full thread view with inline agent reply form (Cmd+Enter to send)

The admin panel uses `apps/admin/src/lib/api.ts` which reads an auth token from `localStorage`. A proper admin auth flow is planned for Phase 5.

---

## Known limitations and Phase 5 scope

| Item | Phase |
|------|-------|
| Push notifications for new agent messages | Phase 5 |
| Streaming AI responses | Phase 5 |
| Admin auth / login flow | Phase 5 |
| Formal request creation from conversation | Phase 5 |
| Conversation archival and resolution workflow | Phase 5 |
| conversationId persisted in SecureStore | Phase 5 |
| Real-time agent dashboard updates | Phase 5 |
| Context refresh triggering new recommendation run | Phase 5 |
