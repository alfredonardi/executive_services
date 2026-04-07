# Recommendation System Architecture

## Architecture Overview

The recommendation system is a NestJS module (`RecommendationModule`) that provides personalized, schedule-aware recommendations for premium executive users in São Paulo. It operates entirely server-side with deterministic ranking — no real-time AI calls are required for the core recommendation flow (AI enrichment is deferred).

```
HTTP Request
    │
    ▼
RecommendationController
    │
    ├── PreferenceProfileService     ← User's persistent taste/preference profile
    │
    ├── ScheduleContextService       ← Derives free/busy windows from calendar
    │       └── CalendarEventService (consumes, read-only)
    │
    ├── RecommendationCandidateService  ← Filters catalog by profile + context
    │       └── RecommendationCatalogService (reads Recommendation table)
    │
    ├── RecommendationRankingService  ← Deterministic multi-factor scoring
    │
    ├── RecommendationExplanationService  ← Human-readable reason codes
    │
    └── RecommendationFeedbackService  ← Records user reactions
```

Sessions are persisted to `recommendation_sessions` with a snapshot of the context and results at request time.

---

## Schedule Context Derivation

`ScheduleContextService.deriveContext(userId, referenceDate, timezone)` queries the user's calendar for the given day and returns a `ScheduleContext` object. No PII (event titles, attendee names) is included in the context.

### Window Classification Logic

| Window Type     | Condition |
|-----------------|-----------|
| `OCCUPIED`      | Any non-cancelled, non-all-day calendar event |
| `FREE`          | Gap between occupied windows (≥ 5 min) |
| `MORNING_START` | Free window starting before 09:00 with ≥ 30 min duration |
| `MEAL_OPPORTUNITY` | Free gap in 11:30–14:30 window with ≥ 45 min duration |
| `EVENING_FREE`  | Free gap in 19:00–22:00 window with ≥ 60 min duration |
| `PRE_MEETING`   | Free window ending ≤ 30 min before next meeting starts |
| `POST_MEETING`  | Free window starting ≤ 30 min after a meeting ends |

### Opportunity Windows

A window is classified as an **opportunity window** if:
- Its duration is ≥ 45 minutes, OR
- It is a `POST_MEETING` window with duration ≥ 20 minutes (lower bar for quick wins)

### Schedule Density

| Level    | Condition |
|----------|-----------|
| `low`    | < 2 meetings |
| `moderate` | 2–4 meetings |
| `high`   | > 4 meetings |

---

## Preference Profile Model

Stored in the `preference_profiles` table. One profile per user (`@unique userId`).

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `foodPreferences` | String[] | [] | Cuisine preferences (free-form tags) |
| `dietaryConstraints` | String[] | [] | Dietary restrictions |
| `atmospherePreferences` | String[] | [] | Venue atmosphere preferences |
| `preferredCategories` | RecommendationCategory[] | [] | Boost these categories |
| `dislikedCategories` | RecommendationCategory[] | [] | Always exclude these |
| `preferredDurationMin` | Int | 30 | Minimum experience duration in minutes |
| `preferredDurationMax` | Int | 90 | Maximum experience duration in minutes |
| `mobilityTolerance` | String | "moderate" | low/moderate/high |
| `preferredNeighborhoods` | String[] | [] | Preferred São Paulo neighborhoods |
| `pacing` | String | "efficient" | relaxed/efficient/exploratory |
| `wellnessInterest` | Boolean | false | Enables wellness bonus in ranking |
| `businessTravelStyle` | String | "premium" | budget/efficient/premium/experience |
| `additionalNotes` | String? | null | Free-text personalization notes |

---

## Catalog Model and Seeding Strategy

The catalog is stored in the `recommendations` table. New fields added:

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `minDurationMinutes` | Int | 20 | Minimum time needed for this experience |
| `sourceType` | String | "SEED" | SEED / CURATED / PARTNER |
| `premiumScore` | Int | 3 | Curation quality score 1–5 |
| `suitableWindows` | String[] | [] | LUNCH, BREAKFAST, DINNER, AFTER_MEETING, MORNING, EVENING, ANY |

### Demo Catalog Seed

`RecommendationCatalogService.seedDemoCatalog()` seeds 15 demo entries on first run (skips if any exist). All entries have `sourceType: "SEED"` and clearly marked `(Demo)` in their titles. Categories covered:

- **Restaurants** (4): Jardins, Itaim Bibi, Vila Nova Conceição, Pinheiros
- **Wellness** (3): Jardins, Itaim Bibi, Bela Vista
- **Business Support** (3): Faria Lima, Jardins, Guarulhos (airport), Itaim Bibi (pharmacy)
- **Short Experiences** (2): Bela Vista (MASP), Vila Madalena
- **Micro Experiences** (2): Ibirapuera, Jardins (wine tasting)

---

## Ranking Methodology

All scoring is deterministic. No AI calls in the core ranking path.

### Score Factors (total raw max ≈ 100)

| Factor | Max Points | Logic |
|--------|-----------|-------|
| **Category fit** | +25 / −50 | +25 if preferred; −50 if disliked; 0 otherwise |
| **Timing fit** | 0–20 | Match item's `suitableWindows` against detected context window types. Proportion of matches × 20. |
| **Duration fit** | 0–15 | How well item duration fits the best available free window. Closer slack = higher score. |
| **Neighborhood fit** | 0–15 | +15 if neighborhood matches `preferredNeighborhoods`; +5 if no preference (flexible) |
| **Premium relevance** | 0–10 | `premiumScore × 2` |
| **Wellness bonus** | 0–10 | +10 if `wellnessInterest=true` AND category=WELLNESS |
| **Diversity penalty** | −10 | Applied if the same category has already appeared earlier in the sorted list |
| **Business travel fit** | 0–5 | Matches `businessTravelStyle` against item price level / duration / premium score |

### Normalization

After all factors are applied, raw scores are normalized to 0–100 using min-max normalization:
```
normalizedScore = ((rawScore - min) / (max - min)) × 100
```

Results are returned sorted by `normalizedScore` descending, capped at 8 recommendations.

---

## Explanation Contract

`RecommendationExplanationService.explainRecommendation()` returns machine-readable `RecommendationReason[]` objects.

| Code | Label | Trigger |
|------|-------|---------|
| `PREFERRED_CATEGORY` | Matches your preferred category | Category is in `preferredCategories` |
| `MEAL_WINDOW_FIT` | Fits your lunch window | `hasMealOpportunity=true` AND item suits meal windows |
| `PREFERRED_NEIGHBORHOOD` | Located in your preferred area | Neighborhood matches `preferredNeighborhoods` |
| `WELLNESS_MATCH` | Matches your wellness interest | `wellnessInterest=true` AND category=WELLNESS |
| `PREMIUM_QUALITY` | Highly curated premium venue | `premiumScore ≥ 4` |
| `DURATION_FIT` | Fits within your available time | At least one free window ≥ item duration |
| `SCHEDULE_GAP` | Good fit for your current schedule gap | `opportunityWindows.length > 0` |
| `BUSINESS_TRAVEL_FIT` | Well-suited for business travelers | `businessTravelStyle=premium` AND `priceLevel ≥ 3` |

Every result includes at least one reason. If no specific reason applies, `SCHEDULE_GAP` is used as a fallback.

---

## API Endpoints

All endpoints require JWT Bearer authentication.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/recommendations/profile` | Get preference profile (null if none exists) |
| `POST` | `/recommendations/profile` | Create or update preference profile |
| `GET` | `/recommendations` | Get personalized recommendations. Query params: `from`, `to` (ISO 8601) |
| `POST` | `/recommendations/feedback` | Submit feedback on a recommendation |
| `GET` | `/recommendations/sessions` | List last 10 recommendation sessions |

### Feedback Actions

Valid values for the `action` field: `HELPFUL`, `NOT_HELPFUL`, `SAVED`, `DISMISSED`, `ACTED_ON`

---

## Assumptions and Deferred Work

### Assumptions Made
1. Calendar events are already synced — the system reads from the local DB, no live API calls.
2. All times are treated in UTC at the service layer; timezone is passed through as metadata.
3. A user with no preference profile gets a default "blank" profile created on first recommendation request.
4. Catalog items with `isActive=false` are always excluded.

### Deferred / Future Work
1. **AI enrichment**: The `RecommendationRankingService` currently uses only deterministic scoring. A future version can call an AI model to re-score or explain candidates using contextual data.
2. **Real-time availability**: Catalog items do not yet have real-time slot availability. Integration with booking APIs is out of scope for MVP.
3. **Collaborative filtering**: No cross-user signals are used. Future work could incorporate anonymized interaction patterns.
4. **Interaction feedback loop**: `UserInteraction` records are not yet fed back into the ranking. A future service can weight `ACTED_ON` and `DISMISSED` signals.
5. **Multi-day windows**: The current schedule context is derived for a single reference day. Multi-day recommendation windows are not yet supported.
6. **Geo-proximity**: Neighborhood matching is currently exact-string-based. Future work should use geo-coordinates and driving-time estimates.
