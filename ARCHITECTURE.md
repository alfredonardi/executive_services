# ARCHITECTURE — Executive Concierge SP

## Architectural Style

**Modular Monolith** — a single deployable backend unit with strong internal module boundaries, designed to extract services later if warranted. Avoids premature complexity while maintaining domain clarity.

**API-First** — all functionality exposed via documented REST APIs. The mobile app and admin panel are pure API clients.

**Event-Driven internally** — modules communicate via internal events for decoupling. Redis-backed queues for async operations.

---

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Client Layer                          │
│  ┌─────────────────────┐  ┌────────────────────────┐   │
│  │   Mobile App        │  │   Admin Web Panel      │   │
│  │   (React Native     │  │   (Next.js)            │   │
│  │    + Expo)          │  │                        │   │
│  └──────────┬──────────┘  └───────────┬────────────┘   │
└─────────────┼───────────────────────── ┼────────────────┘
              │ HTTPS / REST             │ HTTPS / REST
┌─────────────▼───────────────────────── ▼────────────────┐
│                   API Gateway / Reverse Proxy            │
│                   (nginx / cloud LB)                     │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│                  Backend (NestJS Monolith)               │
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │   Auth      │  │   Users     │  │   Calendar      │ │
│  │   Module    │  │   Module    │  │   Module        │ │
│  └─────────────┘  └─────────────┘  └─────────────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │ Concierge   │  │Recommendations│ │   Requests      │ │
│  │ Chat Module │  │   Module    │  │   Module        │ │
│  └─────────────┘  └─────────────┘  └─────────────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │    AI       │  │Notifications│  │   Admin         │ │
│  │   Module    │  │   Module    │  │   Module        │ │
│  └─────────────┘  └─────────────┘  └─────────────────┘ │
│  ┌─────────────────────────────────────────────────────┐│
│  │              Shared Infrastructure                  ││
│  │  (Logger, Events, Config, Audit, Health, Metrics)   ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│                   Data Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │  PostgreSQL  │  │    Redis     │  │  Object Store │ │
│  │  (Primary DB)│  │  (Cache +    │  │  (S3/R2)      │ │
│  │              │  │   Queues)    │  │               │ │
│  └──────────────┘  └──────────────┘  └───────────────┘ │
└─────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│                External Services                        │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │ Google/      │  │  AI Provider │  │  Push Notif.  │ │
│  │ Microsoft    │  │  (OpenAI,    │  │  (FCM/APNs)   │ │
│  │ Calendar API │  │   Anthropic) │  │               │ │
│  └──────────────┘  └──────────────┘  └───────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## Module Responsibilities

### Auth Module
- User registration (invite-only)
- Email/password login + MFA (TOTP)
- JWT access tokens + refresh tokens
- OAuth2 for calendar integrations
- Session management and revocation
- Password reset flow
- Audit log of auth events

### Users Module
- User profiles and preferences
- Role management (EXECUTIVE, CONCIERGE_AGENT, ADMIN)
- Preference engine (dietary, wellness, interests)
- GDPR-compliant data export and deletion
- Invite management

### Calendar Module
- OAuth2 token management for Google/Outlook
- Calendar sync (read-only, on-demand + scheduled)
- Event normalization into internal format
- "Window" detection (free time gaps)
- Upcoming trip detection

### Concierge Chat Module
- Conversation management (sessions, messages)
- AI message routing and context assembly
- Human handoff detection and management
- Message threading and history
- Real-time message delivery (WebSocket or SSE)
- Concierge agent message interface

### AI Module (Abstraction Layer)
- Provider-agnostic AI interface
- Context assembly (user profile, schedule, location, history)
- Prompt management and versioning
- RAG preparation (document ingestion, vector search)
- Response validation and fallback
- Cost and quality monitoring
- Audit log for all AI calls

### Recommendations Module
- Recommendation catalog management
- Rule-based recommendation engine
- AI-enhanced relevance scoring
- Context-aware filtering (schedule gaps, location, time of day)
- User interaction tracking (save, dismiss, act)
- Category management

### Requests Module
- Request creation from chat or directly
- Status tracking (PENDING, IN_PROGRESS, COMPLETED, CANCELLED)
- Assignment to concierge agents
- Notes and updates
- Deadline and urgency management
- Notification triggers

### Notifications Module
- Push notification delivery (FCM + APNs)
- Email notifications
- In-app notification feed
- User notification preferences
- Delivery tracking

### Admin Module
- Agent dashboard (request queue, user list)
- User management (view, invite, manage)
- Catalog management (recommendations)
- Basic metrics and reporting
- System health dashboard

### Shared Infrastructure
- Structured logging (JSON, correlation IDs)
- Event bus (internal)
- Configuration management
- Health checks and readiness probes
- Metrics collection
- OpenTelemetry tracing

---

## Data Architecture

### Primary Database: PostgreSQL

Managed via Prisma ORM. Migrations are code-versioned and run in CI.

Key design principles:
- UUID primary keys
- `createdAt` / `updatedAt` on all tables
- Soft deletes where appropriate (`deletedAt`)
- Row-level data for sensitive fields (encrypted at application level)
- Audit log table for sensitive operations

### Cache & Queue: Redis

- Session/token cache
- Calendar sync job queue (BullMQ)
- Notification delivery queue
- AI request rate limiting
- Feature flag cache

### Object Storage (S3/R2)

- User profile images
- Recommendation images and assets
- AI audit logs (long-term retention)

---

## AI Architecture

### Provider Abstraction

```typescript
interface AIProvider {
  chat(messages: ChatMessage[], options: ChatOptions): Promise<AIResponse>;
  embed(text: string): Promise<number[]>;
}
```

Implementations: OpenAI, Anthropic, with Ollama as local fallback.

### Concierge AI Context

Each AI request includes:
- System prompt (role, tone, constraints)
- User profile context (preferences, nationality, company)
- Current schedule (today + next 2 days)
- Location context (neighborhood, hotel)
- Recent conversation history (last 10 messages)
- Active requests
- Relevant recommendation catalog excerpts

### RAG (Future-ready)

- Recommendation catalog ingested as vector embeddings
- São Paulo context documents (neighborhoods, cultural norms, etc.)
- Private documents per user (if consented)

---

## Security Architecture

### Authentication
- JWT with short-lived access tokens (15 min)
- Refresh tokens (7 days, rotation on use)
- MFA via TOTP (Google Authenticator compatible)
- Invite-only registration

### Authorization
- Role-Based Access Control (RBAC)
- Roles: `EXECUTIVE`, `CONCIERGE_AGENT`, `ADMIN`
- Resource-level guards on all endpoints
- Executives cannot access other executives' data

### Data Security
- TLS 1.3 in transit
- AES-256 encryption at rest (cloud provider level)
- Application-level encryption for sensitive fields (PII)
- Secrets managed via environment variables / Vault / AWS Secrets Manager
- No secrets in source code

### Privacy
- Minimal data collection by design
- Calendar data: read-only, not stored permanently (normalized events cached briefly)
- Clear consent for each integration
- Data export and deletion endpoints
- Audit trail for all data access and modifications

### Audit Trail
- Append-only audit log table
- All auth events, data modifications, AI calls, concierge actions logged
- Log integrity verified periodically

---

## API Design

- RESTful JSON API
- OpenAPI 3.1 specification (auto-generated from NestJS decorators)
- Versioned: `/api/v1/`
- Consistent error format:
  ```json
  {
    "statusCode": 400,
    "error": "BAD_REQUEST",
    "message": "Validation failed",
    "details": [...],
    "requestId": "uuid"
  }
  ```
- Pagination: cursor-based for lists
- Rate limiting per user and per endpoint class

---

## Observability

- **Logs**: Pino (structured JSON), with correlation ID propagation
- **Metrics**: Prometheus-compatible (via `@nestjs/terminus` + custom)
- **Tracing**: OpenTelemetry with Jaeger or Tempo as backend
- **Alerting**: Grafana alerts on error rate, latency, AI cost
- **Health checks**: `/health/liveness` and `/health/readiness`
- **Feature flags**: LaunchDarkly or self-hosted Unleash

---

## Deployment Architecture

### Environments
- `local` — developer workstation (Docker Compose)
- `staging` — mirrors production, used for QA and integration tests
- `production` — cloud-hosted (AWS, GCP, or Railway for MVP)

### Infrastructure
- Containerized workloads (Docker)
- Orchestration: Docker Compose (MVP) → Kubernetes (scale)
- Database: managed PostgreSQL (RDS or Supabase)
- Redis: managed (ElastiCache or Upstash)
- CDN for static assets

### CI/CD
- GitHub Actions
- On PR: lint → unit tests → build → integration tests
- On merge to main: deploy to staging → smoke tests → promote to production
- Semantic versioning + changelog generation

---

## Non-Functional Requirements

| Requirement | Target |
|---|---|
| API P95 latency | < 300ms |
| AI response latency | < 5s (streaming preferred) |
| Uptime | > 99.5% (MVP), 99.9% (scale) |
| RTO | < 1 hour |
| RPO | < 15 minutes |
| Concurrent users (MVP) | 50–200 |
| Data retention | 2 years (configurable) |
