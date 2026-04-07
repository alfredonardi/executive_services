# Executive Concierge SP

> Premium digital concierge for foreign executives visiting São Paulo.

A private, AI-powered concierge platform designed for high-net-worth foreign executives (primarily North American) visiting São Paulo on business or bleisure trips.

---

## What This Is

A hub for:
- **Agenda organization** — sync your calendar, see free windows, plan your stay
- **AI Concierge Chat** — instant, context-aware assistance with human handoff
- **Curated Recommendations** — restaurants, wellness, experiences based on your schedule and preferences
- **Request Tracking** — submit and track concierge requests with real-time status
- **Discreet Operations** — premium, privacy-first experience

---

## Architecture

**Monorepo** (Turborepo + npm workspaces) with:

| App/Package | Tech | Port |
|---|---|---|
| `apps/api` | NestJS + Prisma + PostgreSQL | 3000 |
| `apps/mobile` | React Native + Expo | N/A |
| `apps/admin` | Next.js | 3001 |
| `packages/types` | TypeScript shared types | N/A |

See [ARCHITECTURE.md](ARCHITECTURE.md) for full system design.

---

## Quick Start

### Prerequisites

- Node.js 20+
- Docker (for PostgreSQL and Redis)
- Expo CLI (`npm install -g expo-cli`)

### 1. Clone and install

```bash
git clone <repo>
cd executive_services
npm install
```

### 2. Start infrastructure

```bash
docker compose up -d postgres redis
```

### 3. Configure API

```bash
cp apps/api/.env.example apps/api/.env
# Edit .env with your secrets
```

### 4. Run migrations and seed

```bash
cd apps/api
npx prisma migrate dev
npx prisma db seed
```

### 5. Start development

```bash
# From root
npm run dev
# Starts API on :3000 and Admin on :3001

# Mobile (separate terminal)
cd apps/mobile
npx expo start
```

---

## Documentation

| Document | Description |
|---|---|
| [PRODUCT_BRIEF.md](PRODUCT_BRIEF.md) | Product vision, users, principles |
| [MVP_SCOPE.md](MVP_SCOPE.md) | MVP features, user stories, flows |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Technical architecture, modules |
| [ROADMAP.md](ROADMAP.md) | Implementation phases and plan |
| [docs/adr/](docs/adr/) | Architectural Decision Records |

---

## Key Decisions

| Decision | Choice |
|---|---|
| Architecture | Modular monolith |
| Auth | JWT + TOTP MFA, invite-only |
| AI | Provider-abstracted (OpenAI default) |
| Calendar | Google + Outlook OAuth2 (read-only) |
| Database | PostgreSQL + Prisma |
| Cache | Redis + BullMQ |

See [ADR-001](docs/adr/ADR-001-monorepo-turborepo.md) through [ADR-005](docs/adr/ADR-005-authentication.md) for rationale.

---

## Development

```bash
npm run build      # Build all
npm run test       # Run all tests
npm run lint       # Lint all
npm run format     # Format all
```

### API

```bash
cd apps/api
npm run db:generate     # Regenerate Prisma client
npm run db:migrate      # Run migrations
npm run db:studio       # Open Prisma Studio
npm run test:unit       # Unit tests
```

---

## Security Notes

- Never commit `.env` files
- MFA is required for all users
- All calendar data is read-only
- Refresh tokens are rotated on use
- All AI calls are audited

---

## Status: Phase 0 — Foundation ✓

See [ROADMAP.md](ROADMAP.md) for what's next.