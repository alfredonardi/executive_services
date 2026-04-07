# ROADMAP — Executive Concierge SP

## Phase 0 — Foundation (Weeks 1–3)
**Goal:** Repository, tooling, infrastructure, and skeleton apps running.

### Deliverables
- [x] Monorepo structure (Turborepo)
- [x] Documentation: PRODUCT_BRIEF, MVP_SCOPE, ARCHITECTURE, ADRs
- [x] Backend skeleton (NestJS + Prisma + PostgreSQL)
- [x] Mobile app skeleton (React Native + Expo)
- [x] Admin panel skeleton (Next.js)
- [x] Initial Prisma schema (all core entities)
- [x] OpenAPI contract baseline
- [x] Docker Compose for local development
- [x] CI/CD pipeline (GitHub Actions)
- [x] Observability baseline (logs, health checks)

---

## Phase 1 — Auth & Users (Weeks 4–5)
**Goal:** Secure authentication and user profiles working end-to-end.

### Deliverables
- [ ] Invite-only registration flow
- [ ] Email + password + MFA (TOTP)
- [ ] JWT access + refresh token management
- [ ] User profile creation and editing
- [ ] Preference management (dietary, wellness, interests)
- [ ] Role-based access control (EXECUTIVE, AGENT, ADMIN)
- [ ] Auth screens in mobile app
- [ ] Admin user management screen
- [ ] Password reset flow
- [ ] Auth audit logging

---

## Phase 2 — Calendar Integration (Weeks 6–7)
**Goal:** Google and Outlook calendar sync working, schedule visible in app.

### Deliverables
- [ ] Google Calendar OAuth2 connection
- [ ] Microsoft Outlook OAuth2 connection
- [ ] Calendar sync job (scheduled + on-demand)
- [ ] Event normalization and storage
- [ ] Free window detection algorithm
- [ ] Today + next days schedule view in mobile app
- [ ] Calendar connection screen in app
- [ ] Sync status and error handling

---

## Phase 3 — Recommendations (Weeks 8–9)
**Goal:** Curated recommendations engine and catalog management working.

### Deliverables
- [ ] Recommendation catalog data model and admin CRUD
- [ ] Category management (Restaurants, Wellness, Experiences, Business Support)
- [ ] Rule-based recommendation engine (schedule gaps, time of day, preferences)
- [ ] AI relevance scoring integration
- [ ] Recommendation display in mobile app
- [ ] "Why this?" explanation per recommendation
- [ ] Save / dismiss / act interactions
- [ ] Admin catalog management screen

---

## Phase 4 — Concierge Chat (Weeks 10–12)
**Goal:** AI concierge chat working with human handoff capability.

### Deliverables
- [ ] Chat UI in mobile app
- [ ] AI provider abstraction layer
- [ ] Context assembly (profile + schedule + catalog)
- [ ] Conversation management (sessions, messages, history)
- [ ] Streaming AI responses
- [ ] Human handoff detection and escalation
- [ ] Agent chat interface in admin panel
- [ ] AI audit logging
- [ ] Basic RAG preparation (catalog indexed)

---

## Phase 5 — Requests & Notifications (Weeks 13–14)
**Goal:** Formal request tracking and notification system working.

### Deliverables
- [ ] Request creation (from chat and direct)
- [ ] Request status tracking (PENDING → IN_PROGRESS → COMPLETED)
- [ ] Agent assignment and notes
- [ ] Push notifications (FCM + APNs setup)
- [ ] In-app notification feed
- [ ] Notification preferences
- [ ] Admin request queue screen

---

## Phase 6 — Quality & Hardening (Weeks 15–16)
**Goal:** Production-ready quality gates and observability.

### Deliverables
- [ ] Unit test coverage > 70% for business logic
- [ ] Integration tests for all API endpoints
- [ ] Contract tests for external integrations
- [ ] OpenTelemetry tracing setup
- [ ] Prometheus metrics
- [ ] Grafana dashboards (error rate, latency, AI cost)
- [ ] Security audit and penetration test basics
- [ ] Load test (50 concurrent users)
- [ ] Runbook documentation
- [ ] Data backup and restore verified

---

## Phase 7 — Beta Launch (Weeks 17–18)
**Goal:** First real users using the product.

### Deliverables
- [ ] Production environment provisioned
- [ ] TestFlight / Play Store internal testing
- [ ] 5–10 beta users onboarded
- [ ] Feedback collection mechanism
- [ ] On-call rotation setup
- [ ] SLA monitoring active
- [ ] Post-beta retro and backlog update

---

## Future Phases (Post-MVP)

### Transport Integration
- Integration with existing executive transport service
- Booking and tracking in app

### Payment
- Subscription management
- Service fee billing

### Multi-language
- Portuguese, Spanish, French, Mandarin

### Partner Integrations
- Hotel API integrations
- Restaurant booking APIs (OpenTable, Resy)
- Wellness booking APIs

### Advanced AI
- Long-term user memory and personalization
- Proactive recommendations (push before user asks)
- Trip planning AI assistant

### Analytics
- Advanced product analytics
- Business intelligence dashboard
- Predictive demand modeling

---

## Technical Debt Register

| Item | Priority | Target Phase |
|---|---|---|
| Move to cursor-based pagination everywhere | Medium | Phase 5 |
| Add rate limiting per endpoint | High | Phase 4 |
| Extract AI module to microservice if cost warrants | Low | Post-MVP |
| Replace in-memory event bus with Redis pub/sub | Medium | Phase 5 |
| Add OpenTelemetry to mobile app | Medium | Phase 6 |

---

## Key Risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| AI response quality below expectations | Medium | High | Human handoff, quality monitoring, prompt tuning |
| Calendar OAuth complexity | Medium | Medium | Start with Google only, add Microsoft in Phase 2 |
| Push notification delivery on iOS | Low | Medium | Early testing on TestFlight |
| Database performance at scale | Low | High | Index from day 1, monitor query plans |
| Single-provider AI dependency | Medium | High | Abstraction layer enables provider switch |
