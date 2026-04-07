# ADR-008: Recommendation Architecture

**Status**: Accepted  
**Date**: 2026-04-07  
**Deciders**: Engineering Team  
**Technical Story**: Implement a personalized, schedule-aware recommendation system for the Executive Concierge SP app

---

## Context

Executive users of the São Paulo concierge app have limited time between engagements. They need relevant, high-quality recommendations — restaurants, wellness venues, short experiences, and business support services — that:

1. Fit their **available schedule windows** (derived from their calendar)
2. Match their **personal preferences** (cuisine, neighborhood, pace, wellness interest)
3. Come with **clear explanations** of why a recommendation was surfaced
4. Respect their **dislikes** (e.g., certain cuisine types or categories)
5. Support a **feedback loop** (helpful / dismissed / acted-on)

The system must be reliable and fast without depending on real-time AI inference on every request, while leaving room to incorporate AI enrichment in a future iteration.

---

## Decision

We will implement a **deterministic-first, multi-factor ranking system** with the following architecture:

### Core Pipeline

1. **Schedule Context Derivation** — Read calendar events for the target day via `CalendarEventService` and derive anonymized `TimeWindow` objects (free/busy/meal/evening). No PII is passed downstream.

2. **Preference Profile** — A persistent `PreferenceProfile` table stores the user's explicit preferences. Sensible defaults are created on first use.

3. **Catalog Filtering** — `RecommendationCandidateService` filters the curated catalog by: disliked categories, duration availability, and window type compatibility.

4. **Deterministic Ranking** — `RecommendationRankingService` scores each candidate using 8 weighted factors (category fit, timing fit, duration fit, neighborhood fit, premium score, wellness bonus, diversity penalty, business travel style). All factors use integer arithmetic — fully reproducible.

5. **Human-readable Explanations** — `RecommendationExplanationService` maps the scoring factors to machine-readable `RecommendationReason` objects with stable `code` strings for i18n / frontend rendering.

6. **Session Persistence** — Each request creates a `RecommendationSession` row with context and results snapshots for audit, debugging, and future feedback integration.

### AI Enrichment (Deferred)

The current system does **not** call an AI model per recommendation request. The pipeline is designed to accept an optional AI re-ranking step after the deterministic ranking — this hook can be added when response quality data from user feedback is available to train/prompt effectively.

---

## Consequences

### Positive
- **Fast**: No AI latency on the hot recommendation path; p99 should be well under 500ms.
- **Deterministic**: Results can be unit-tested without mocks; ranking is reproducible and auditable.
- **Explainable**: Every recommendation carries structured reason codes.
- **Extensible**: The pipeline is modular — AI enrichment, collaborative filtering, or geo-proximity scoring can be added as new services without changing the orchestration layer.
- **Privacy-first**: Schedule context never exposes raw event titles or attendee details.

### Negative / Trade-offs
- **No semantic understanding**: The deterministic ranker cannot infer that a user who likes "sushi" probably also likes "Japanese whisky bars". This requires AI or collaborative filtering.
- **Explicit preference required**: The system works best when users have filled in a preference profile. Cold-start users get generic results.
- **Single-day context**: The current schedule context is limited to a single reference day. Multi-day planning requires future work.

---

## Alternatives Considered

### A. AI-First Ranking (GPT/Claude on every request)
- **Pro**: Richer semantic understanding, natural language preference capture.
- **Con**: Latency (1–3s per request), cost per call, non-deterministic results, harder to test, dependency on external service availability.
- **Verdict**: Deferred. Can be added as an optional enrichment step after deterministic ranking.

### B. Pure Rule-Based System (hard-coded heuristics)
- **Pro**: Simple, fast, easy to reason about.
- **Con**: Cannot adapt to user preferences without explicit coding of every rule. Does not scale to a growing catalog or preference space.
- **Verdict**: Too rigid. Multi-factor weighted scoring gives more flexibility.

### C. Collaborative Filtering / ML Model
- **Pro**: Learns from aggregate user behavior; improves over time without explicit preference input.
- **Con**: Requires significant interaction data to be effective (cold-start problem). Infrastructure overhead.
- **Verdict**: Deferred until sufficient interaction data is available from `recommendation_feedbacks` and `user_interactions` tables.

### D. Embedding-Based Similarity (vector search)
- **Pro**: Can handle semantic similarity between preferences and catalog items.
- **Con**: Requires embedding infrastructure, a vector store, and adds latency. Overkill for MVP catalog size (< 500 items).
- **Verdict**: Deferred. Viable at catalog scale > 1,000 items or when AI enrichment is active.

---

## Related ADRs

- ADR-001: Technology Stack (NestJS + Prisma + PostgreSQL)
- ADR-004: Calendar Integration Architecture
- ADR-007: AI Module Design (if exists)
