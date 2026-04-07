# ADR-003: Modular Monolith Backend Architecture

**Date:** 2026-04-07  
**Status:** Accepted  
**Deciders:** Tech Lead

---

## Context

We need to decide between microservices, a monolith, or a middle ground for the backend architecture. The team is small (2–5 engineers), the product is in MVP stage, and we must move fast without incurring distributed systems overhead.

## Decision

**Modular Monolith** using NestJS modules with strict domain boundaries.

Each domain is a NestJS module with its own:
- Controllers (HTTP interface)
- Services (business logic)
- Repositories (data access)
- DTOs (request/response shapes)
- Events (internal integration)

Modules communicate only through public service interfaces or internal event bus — never via direct database queries across domains.

## Rationale

- **Simplicity**: Single deployable artifact, no network overhead between modules
- **Speed**: Faster to develop and debug than microservices
- **Evolution**: Clear module boundaries enable extraction to services if warranted
- **Consistency**: Single database transaction possible when needed
- **Tooling**: No service discovery, no distributed tracing complexity (yet)
- **Team size**: Microservices for < 5 engineers is premature optimization

## Alternatives Considered

- **Microservices from day 1**: Complex, slow, expensive infrastructure overhead for MVP. Rejected.
- **Pure monolith (no module boundaries)**: Fast initially but unmanageable at scale. Rejected.
- **Serverless**: Poor fit for stateful concierge workflows and WebSocket/SSE. Rejected.

## Consequences

- Strong discipline required: engineers must not bypass module boundaries
- Linting rules enforce no cross-module database access
- Event bus interface must be stable (internal contract)
- Extraction to microservices is possible but will require careful planning
- Single process: memory and CPU must be monitored
