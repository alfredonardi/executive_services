# ADR-005: Authentication Strategy

**Date:** 2026-04-07  
**Status:** Accepted  
**Deciders:** Tech Lead

---

## Context

Executive users demand high security and a frictionless experience. The product handles sensitive data (schedules, preferences, concierge requests). Authentication must be secure, modern, and support calendar integrations (OAuth2).

## Decision

**JWT-based authentication with TOTP MFA and OAuth2 for calendar integrations.**

### Login Flow
1. User submits email + password
2. Backend validates credentials (bcrypt hash comparison)
3. If MFA enabled: returns `MFA_REQUIRED` challenge
4. User submits TOTP code
5. Backend issues: `accessToken` (15 min) + `refreshToken` (7 days, HTTP-only cookie)
6. Refresh token rotated on each use

### Calendar Integration
- Separate OAuth2 flow per provider (Google, Microsoft)
- OAuth tokens stored encrypted in database
- Refresh handled transparently by CalendarModule
- Consent explicitly tracked per integration

### Registration
- Invite-only: Admin creates invitation with email + role
- User follows invite link → sets password → enables MFA
- No self-registration in MVP

### Roles
| Role | Access |
|---|---|
| `EXECUTIVE` | Own data, chat, recommendations |
| `CONCIERGE_AGENT` | All executive data (read), requests, chat |
| `ADMIN` | Full access, user management, system settings |

## Rationale

- JWT is stateless, scales horizontally
- Short access token TTL limits exposure
- Refresh token rotation prevents replay attacks
- HTTP-only cookie for refresh token prevents XSS theft
- MFA is non-negotiable for this user segment and data sensitivity
- Invite-only registration prevents unauthorized access

## Alternatives Considered

- **Session-based auth**: Stateful, harder to scale, not suitable for mobile. Rejected.
- **Auth0/Clerk**: Faster setup but less control, adds external dependency. Deferred to Phase 2 consideration.
- **Passkeys**: Excellent UX but complex implementation. Deferred to post-MVP.
- **Social login (Google)**: Not appropriate for privacy-sensitive executive product. Rejected for primary auth.

## Consequences

- Refresh token storage in DB is required (for revocation)
- Mobile app stores access token in secure storage (SecureStore)
- MFA setup is required during onboarding
- Calendar OAuth tokens need careful encryption and key management
- Token revocation must propagate (logout invalidates refresh token)
