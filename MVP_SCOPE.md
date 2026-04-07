# MVP SCOPE — Executive Concierge SP

## MVP Definition

The MVP is the smallest product that a high-net-worth foreign executive can use to organize their São Paulo stay, get personalized recommendations, and contact a concierge — with a backend that allows the concierge team to operate and respond.

The MVP must be **complete enough to feel premium**, not "beta-quality."

---

## User Stories

### Onboarding

- As a new user, I can download the app and create a profile with my preferences (dietary, wellness, interests, language)
- As a new user, I can connect my Google Calendar or Outlook Calendar
- As a new user, I receive a brief, elegant introduction to the service
- As a returning user, I am recognized and welcomed back

### Agenda & Stay Organization

- As an executive, I can see my schedule for today and the next days of my trip
- As an executive, I can see time gaps in my schedule highlighted as "windows" for recommendations
- As an executive, I can see a clear day-by-day view of my São Paulo stay
- As an executive, I can add notes or requests to specific time slots

### Concierge Chat (AI + Human)

- As an executive, I can open a chat and ask any question about my stay
- As an executive, I can request specific services (restaurant booking, car, wellness session)
- As an executive, I understand when I'm talking to AI vs. a human
- As an executive, I receive a response within 2 hours for non-urgent requests
- As an executive, I can rate the quality of concierge interactions

### Recommendations

- As an executive, I receive curated recommendations based on my schedule gaps, location, and preferences
- As an executive, I can browse by category: Restaurants, Wellness, Short Experiences, Business Support
- As an executive, I can see why a recommendation was made ("Based on your 90-min gap this afternoon")
- As an executive, I can save or dismiss recommendations
- As an executive, I can request to act on a recommendation (the concierge executes it)

### Requests & Tracking

- As an executive, I can make a structured request (e.g., "Book me a table for 2 tonight")
- As an executive, I can track the status of my requests
- As an executive, I receive notifications when a request is updated

### Notifications

- As an executive, I receive subtle push notifications for relevant updates
- As an executive, I can configure notification preferences
- Notifications are relevant, timely, and never spammy

---

## Admin / Backoffice (Concierge Team)

- As a concierge agent, I can see all active users and their current requests
- As a concierge agent, I can take over (handoff) from AI conversations
- As a concierge agent, I can update request statuses and add notes
- As a concierge agent, I can send messages to users
- As a concierge agent, I can see the day view for each user
- As a concierge agent, I can manage the recommendation catalog (add, edit, categorize)
- As an admin, I can manage users, agents, and access permissions
- As an admin, I can see basic product metrics and usage dashboards

---

## MVP Technical Requirements

| Area | Requirement |
|---|---|
| Auth | Secure login (email + MFA), token-based, invite-only onboarding |
| Calendar | Read-only sync with Google Calendar and Outlook |
| AI Chat | LLM-powered concierge with context, RAG-ready, human handoff |
| Recommendations | Rule + AI hybrid, context-aware, categorized |
| Requests | CRUD + status tracking + notifications |
| Admin Panel | Web-based, role-based access control |
| Mobile App | iOS-first (React Native), Android-ready |
| API | REST + OpenAPI documented |
| Database | PostgreSQL via Prisma ORM |
| Cache/Queue | Redis |
| Observability | Structured logs, metrics, tracing from day 1 |
| Security | TLS, secrets management, RBAC, audit trail |
| CI/CD | Automated tests, build, deploy pipeline |

---

## MVP User Flows

### Flow 1: First-Time Onboarding
1. Download app → welcome screen
2. Enter invite code or email
3. Create account (email + password + MFA)
4. Profile setup (name, company, nationality, preferences)
5. Calendar connection (Google/Outlook OAuth)
6. Dashboard: today's agenda + first recommendations
7. Brief intro to concierge chat

### Flow 2: Daily Engagement
1. Open app → see today's schedule
2. See "windows" with recommendations
3. Tap recommendation → details + action button
4. Request action → concierge is notified
5. Notification when request is confirmed/completed
6. Rate the experience

### Flow 3: Concierge Chat
1. Open chat tab
2. Type message in natural language
3. AI responds with context-aware answer
4. If needed: "Let me connect you with our team" → human takes over
5. Human responds in same thread
6. Request created from chat if applicable
7. Follow-up notification

### Flow 4: Admin Operations
1. Concierge agent logs in to web panel
2. Sees active requests sorted by urgency
3. Opens request → sees full context (user profile, schedule, conversation)
4. Responds / executes / updates status
5. User receives notification

---

## Deferred Features (Next Phases)

- Transport booking integration
- Payment processing
- Multi-language support (PT, ES, FR, ZH)
- Offline mode
- Apple/Google Calendar write-back
- Partner integrations (hotels, restaurants API)
- Advanced analytics and reporting
- White-label for hotels/companies
