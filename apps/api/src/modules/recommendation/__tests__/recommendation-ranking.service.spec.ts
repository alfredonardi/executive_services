import { Test, TestingModule } from '@nestjs/testing';
import { RecommendationRankingService, RankedCandidate } from '../services/recommendation-ranking.service';
import { RecommendationCategory } from '@prisma/client';
import { PreferenceProfile } from '@prisma/client';
import { ScheduleContext, TimeWindow } from '../domain/schedule-context.model';

function makeProfile(overrides: Partial<PreferenceProfile> = {}): PreferenceProfile {
  return {
    id: 'profile-1',
    userId: 'user-1',
    foodPreferences: [],
    dietaryConstraints: [],
    atmospherePreferences: [],
    preferredCategories: [],
    dislikedCategories: [],
    preferredDurationMin: 30,
    preferredDurationMax: 90,
    mobilityTolerance: 'moderate',
    preferredNeighborhoods: [],
    pacing: 'efficient',
    wellnessInterest: false,
    businessTravelStyle: 'premium',
    additionalNotes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeContext(overrides: Partial<ScheduleContext> = {}): ScheduleContext {
  return {
    userId: 'user-1',
    referenceDate: new Date('2026-04-07'),
    timezone: 'America/Sao_Paulo',
    occupiedWindows: [],
    freeWindows: [],
    opportunityWindows: [],
    scheduleDensity: 'low',
    isPrimaryWorkDay: false,
    hasMealOpportunity: false,
    hasEveningFree: false,
    nextMeetingStartsAt: null,
    lastMeetingEndsAt: null,
    ...overrides,
  };
}

function makeWindow(type: TimeWindow['type'], durationMinutes: number): TimeWindow {
  const start = new Date('2026-04-07T12:00:00Z');
  return {
    start,
    end: new Date(start.getTime() + durationMinutes * 60_000),
    durationMinutes,
    type,
    label: `${durationMinutes}-min ${type.toLowerCase()} window`,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeItem(overrides: Record<string, any> = {}) {
  return {
    id: `item-${Math.random().toString(36).slice(2)}`,
    title: 'Test Venue',
    description: 'A test venue',
    category: RecommendationCategory.RESTAURANT,
    venue: null,
    address: null,
    neighborhood: 'Jardins',
    city: 'São Paulo',
    latitude: null,
    longitude: null,
    durationMinutes: 60,
    minDurationMinutes: 45,
    priceLevel: 3,
    premiumScore: 3,
    sourceType: 'SEED',
    suitableWindows: ['LUNCH'],
    tags: [],
    imageUrl: null,
    websiteUrl: null,
    phoneNumber: null,
    openingHours: null,
    isActive: true,
    curatedAt: new Date(),
    curatedById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('RecommendationRankingService', () => {
  let service: RecommendationRankingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RecommendationRankingService],
    }).compile();

    service = module.get<RecommendationRankingService>(RecommendationRankingService);
  });

  // ─── Category fit scoring ─────────────────────────────────────────────────

  describe('category fit scoring', () => {
    it('should give +25 for preferred category', async () => {
      const profile = makeProfile({
        preferredCategories: [RecommendationCategory.RESTAURANT],
      });
      const item = makeItem({ category: RecommendationCategory.RESTAURANT });
      const context = makeContext();

      const ranked = await service.rankCandidates([item], profile, context);
      expect(ranked).toHaveLength(1);
      expect(ranked[0]!.scoreBreakdown.categoryFit).toBe(25);
    });

    it('should give -50 for disliked category', async () => {
      const profile = makeProfile({
        dislikedCategories: [RecommendationCategory.WELLNESS],
      });
      const item = makeItem({ category: RecommendationCategory.WELLNESS });
      const context = makeContext();

      const ranked = await service.rankCandidates([item], profile, context);
      expect(ranked).toHaveLength(1);
      expect(ranked[0]!.scoreBreakdown.categoryFit).toBe(-50);
    });

    it('should give 0 for neutral category', async () => {
      const profile = makeProfile();
      const item = makeItem({ category: RecommendationCategory.SHORT_EXPERIENCE });
      const context = makeContext();

      const ranked = await service.rankCandidates([item], profile, context);
      expect(ranked).toHaveLength(1);
      expect(ranked[0]!.scoreBreakdown.categoryFit).toBe(0);
    });
  });

  // ─── Timing fit scoring ───────────────────────────────────────────────────

  describe('timing fit scoring', () => {
    it('should score higher when item suitableWindows match context window types', async () => {
      const profile = makeProfile();
      const context = makeContext({
        freeWindows: [makeWindow('MEAL_OPPORTUNITY', 90)],
        opportunityWindows: [makeWindow('MEAL_OPPORTUNITY', 90)],
      });

      const mealItem = makeItem({ suitableWindows: ['LUNCH'], category: RecommendationCategory.RESTAURANT });
      const eveningItem = makeItem({ suitableWindows: ['DINNER'], category: RecommendationCategory.RESTAURANT });

      const ranked = await service.rankCandidates([mealItem, eveningItem], profile, context);

      const mealRanked = ranked.find((r) => r.item.suitableWindows.includes('LUNCH'));
      const eveningRanked = ranked.find((r) => r.item.suitableWindows.includes('DINNER'));

      expect(mealRanked).toBeDefined();
      expect(eveningRanked).toBeDefined();
      expect(mealRanked!.scoreBreakdown.timingFit).toBeGreaterThan(
        eveningRanked!.scoreBreakdown.timingFit,
      );
    });

    it('should give neutral score for item with empty suitableWindows', async () => {
      const profile = makeProfile();
      const context = makeContext();
      const item = makeItem({ suitableWindows: [] });

      const ranked = await service.rankCandidates([item], profile, context);
      expect(ranked).toHaveLength(1);
      expect(ranked[0]!.scoreBreakdown.timingFit).toBe(10);
    });
  });

  // ─── Diversity penalty ────────────────────────────────────────────────────

  describe('diversity penalty', () => {
    it('should apply -10 diversity penalty for the second item in same category', async () => {
      const profile = makeProfile({
        preferredCategories: [RecommendationCategory.RESTAURANT],
      });
      const context = makeContext({
        freeWindows: [makeWindow('FREE', 120)],
        opportunityWindows: [makeWindow('FREE', 120)],
      });

      const item1 = makeItem({
        category: RecommendationCategory.RESTAURANT,
        premiumScore: 5,
        durationMinutes: 60,
      });
      const item2 = makeItem({
        category: RecommendationCategory.RESTAURANT,
        premiumScore: 5,
        durationMinutes: 60,
      });

      const ranked = await service.rankCandidates([item1, item2], profile, context);

      // Second restaurant in rankings should have diversity penalty applied
      const penaltyApplied = ranked.some((r) => r.scoreBreakdown.diversityPenalty === -10);
      expect(penaltyApplied).toBe(true);
    });

    it('should not apply diversity penalty if categories are different', async () => {
      const profile = makeProfile();
      const context = makeContext();

      const item1 = makeItem({ category: RecommendationCategory.RESTAURANT });
      const item2 = makeItem({ category: RecommendationCategory.WELLNESS });

      const ranked = await service.rankCandidates([item1, item2], profile, context);
      const penalties = ranked.map((r) => r.scoreBreakdown.diversityPenalty);
      expect(penalties.every((p) => p === 0)).toBe(true);
    });
  });

  // ─── Full ranking ─────────────────────────────────────────────────────────

  describe('full ranking', () => {
    it('should return items sorted by normalized score descending', async () => {
      const profile = makeProfile({
        preferredCategories: [RecommendationCategory.WELLNESS],
        wellnessInterest: true,
        preferredNeighborhoods: ['Itaim Bibi'],
      });
      const context = makeContext({
        freeWindows: [makeWindow('MEAL_OPPORTUNITY', 90), makeWindow('FREE', 60)],
        opportunityWindows: [makeWindow('MEAL_OPPORTUNITY', 90)],
        hasMealOpportunity: true,
      });

      const wellnessItem = makeItem({
        category: RecommendationCategory.WELLNESS,
        neighborhood: 'Itaim Bibi',
        premiumScore: 5,
        suitableWindows: ['ANY'],
      });
      const restaurantItem = makeItem({
        category: RecommendationCategory.RESTAURANT,
        neighborhood: 'Pinheiros',
        premiumScore: 2,
        suitableWindows: ['LUNCH'],
      });
      const businessItem = makeItem({
        category: RecommendationCategory.BUSINESS_SUPPORT,
        neighborhood: 'Faria Lima',
        premiumScore: 3,
        suitableWindows: ['ANY'],
      });

      const ranked = await service.rankCandidates(
        [restaurantItem, businessItem, wellnessItem],
        profile,
        context,
      );

      expect(ranked.length).toBe(3);
      // Scores should be sorted descending
      for (let i = 0; i < ranked.length - 1; i++) {
        expect(ranked[i]!.normalizedScore).toBeGreaterThanOrEqual(ranked[i + 1]!.normalizedScore);
      }

      // Wellness item should be ranked first (preferred category + wellness bonus + preferred neighborhood)
      expect(ranked[0]!.item.category).toBe(RecommendationCategory.WELLNESS);
    });

    it('should return empty array for empty candidates', async () => {
      const ranked = await service.rankCandidates([], makeProfile(), makeContext());
      expect(ranked).toEqual([]);
    });

    it('should return normalized scores in 0-100 range', async () => {
      const profile = makeProfile();
      const context = makeContext();
      const items = [makeItem(), makeItem({ premiumScore: 5 }), makeItem({ premiumScore: 1 })];

      const ranked = await service.rankCandidates(items, profile, context);
      for (const r of ranked) {
        expect(r.normalizedScore).toBeGreaterThanOrEqual(0);
        expect(r.normalizedScore).toBeLessThanOrEqual(100);
      }
    });
  });
});
