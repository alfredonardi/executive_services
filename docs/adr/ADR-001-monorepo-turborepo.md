# ADR-001: Monorepo with Turborepo

**Date:** 2026-04-07  
**Status:** Accepted  
**Deciders:** Tech Lead

---

## Context

We need to manage three applications (backend API, mobile app, admin web panel) and shared packages (types, utilities, config) from a single repository. The team is small and moving fast.

## Decision

Use a **monorepo** managed by **Turborepo** with **npm workspaces**.

## Rationale

- Single source of truth for types and contracts (shared packages)
- Atomic commits across app and API changes
- Turborepo provides incremental builds and remote caching
- npm workspaces is built-in, no extra tooling
- Easy dependency management between packages
- Lower overhead than maintaining multiple repos for a small team

## Alternatives Considered

- **Polyrepo**: More isolation but higher coordination cost. Rejected for MVP stage.
- **Nx**: More powerful but heavier. Turborepo is sufficient and lighter.
- **Lerna**: Older, less maintained. Rejected.

## Consequences

- All engineers work in one repo
- CI must handle workspace-aware builds (Turborepo caching)
- Package boundaries must be respected (no circular imports)
- Turborepo cache must be configured for GitHub Actions
