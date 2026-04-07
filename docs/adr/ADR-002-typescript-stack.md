# ADR-002: TypeScript-First Stack

**Date:** 2026-04-07  
**Status:** Accepted  
**Deciders:** Tech Lead

---

## Context

We need to choose a technology stack that supports fast delivery, type safety, shared code between frontend and backend, and a strong ecosystem of libraries for our use case (mobile app, web admin, REST API, AI integration).

## Decision

**TypeScript** across all layers:

| Layer | Technology |
|---|---|
| Mobile App | React Native + Expo |
| Admin Web | Next.js (App Router) |
| Backend API | NestJS |
| ORM | Prisma |
| Database | PostgreSQL |
| Cache/Queue | Redis + BullMQ |
| AI Abstraction | Custom TypeScript layer |
| Runtime | Node.js 20 LTS |

## Rationale

- **Single language** across all layers reduces cognitive switching and enables code sharing
- **React Native + Expo**: fastest path to production iOS app, strong ecosystem, OTA updates
- **Next.js**: battle-tested, SSR/SSG for admin, excellent developer experience
- **NestJS**: structured, modular, decorator-based, excellent for growing teams, built-in OpenAPI support
- **Prisma**: type-safe ORM with migration management, excellent DX
- **PostgreSQL**: most reliable relational database, JSONB for flexible fields, full-text search
- **Redis + BullMQ**: industry standard for queues and caching in Node.js ecosystem
- Shared types package eliminates API contract drift between backend and clients

## Alternatives Considered

- **Go backend**: Better raw performance but no code sharing, slower initial delivery. Rejected for MVP.
- **Python/FastAPI**: Great for AI workloads but mixed-language monorepo is complex. Rejected.
- **Supabase as backend**: Reduces boilerplate but limits business logic control. Rejected — we need custom concierge logic.
- **Flutter for mobile**: Cross-platform but React Native ecosystem is deeper for our use case. Rejected.

## Consequences

- All engineers should be comfortable with TypeScript
- Shared `@executive/types` package must be maintained
- Node.js performance characteristics must be considered for CPU-intensive tasks (use queues for AI calls)
- Expo managed workflow simplifies deployment but limits native module access
