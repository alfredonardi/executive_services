import { Test, TestingModule } from '@nestjs/testing';
import { RecommendationCandidateService } from '../services/recommendation-candidate.service';
import { RecommendationCatalogService } from '../services/recommendation-catalog.service';
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
    label: `${durationMinutes}-min window`,
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
    suitableWindows: ['LUNCH', 'ANY'],
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

describe('RecommendationCandidateService', () => {
  let service: RecommendationCandidateService;
  let catalogService: jest.Mocked<RecommendationCatalogService>;

  beforeEach(async () => {
    const mockCatalogService = {
      getCatalogItems: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecommendationCandidateService,
        { provide: RecommendationCatalogService, useValue: mockCatalogService },
      ],
    }).compile();

    service = module.get<RecommendationCandidateService>(RecommendationCandidateService);
    catalogService = module.get(RecommendationCatalogService);
  });

  // ─── Filtering by disliked category ──────────────────────────────────────

  describe('filtering by disliked category', () => {
    it('should exclude items in dislikedCategories', async () => {
      const profile = makeProfile({
        dislikedCategories: [RecommendationCategory.WELLNESS],
      });
      const context = makeContext({
        freeWindows: [makeWindow('FREE', 120)],
        opportunityWindows: [makeWindow('FREE', 120)],
      });

      const wellnessItem = makeItem({ category: RecommendationCategory.WELLNESS, suitableWindows: ['ANY'] });
      const restaurantItem = makeItem({ category: RecommendationCategory.RESTAURANT, suitableWindows: ['ANY'] });

      catalogService.getCatalogItems.mockResolvedValue([wellnessItem, restaurantItem]);

      const candidates = await service.generateCandidates({ profile, context });
      expect(candidates.some((c) => c.category === RecommendationCategory.WELLNESS)).toBe(false);
      expect(candidates.some((c) => c.category === RecommendationCategory.RESTAURANT)).toBe(true);
    });

    it('should return all items when dislikedCategories is empty', async () => {
      const profile = makeProfile({ dislikedCategories: [] });
      const context = makeContext({
        freeWindows: [makeWindow('FREE', 120)],
        opportunityWindows: [makeWindow('FREE', 120)],
      });

      const items = [
        makeItem({ category: RecommendationCategory.WELLNESS, suitableWindows: ['ANY'] }),
        makeItem({ category: RecommendationCategory.RESTAURANT, suitableWindows: ['ANY'] }),
      ];
      catalogService.getCatalogItems.mockResolvedValue(items);

      const candidates = await service.generateCandidates({ profile, context });
      expect(candidates.length).toBe(2);
    });
  });

  // ─── Filtering by duration mismatch ──────────────────────────────────────

  describe('filtering by duration mismatch', () => {
    it('should exclude items requiring more time than the requested window', async () => {
      const profile = makeProfile();
      const context = makeContext();

      const longItem = makeItem({ durationMinutes: 120, minDurationMinutes: 100, suitableWindows: ['ANY'] });
      const shortItem = makeItem({ durationMinutes: 30, minDurationMinutes: 20, suitableWindows: ['ANY'] });

      catalogService.getCatalogItems.mockResolvedValue([longItem, shortItem]);

      // Requested window of only 45 minutes
      const requestedWindow = {
        start: new Date('2026-04-07T12:00:00Z'),
        end: new Date('2026-04-07T12:45:00Z'),
      };

      const candidates = await service.generateCandidates({ profile, context, requestedWindow });
      expect(candidates.some((c) => c.minDurationMinutes > 45)).toBe(false);
      expect(candidates.some((c) => c.minDurationMinutes <= 45)).toBe(true);
    });
  });

  // ─── Empty catalog ────────────────────────────────────────────────────────

  describe('empty catalog', () => {
    it('should return empty array when catalog is empty', async () => {
      catalogService.getCatalogItems.mockResolvedValue([]);
      const profile = makeProfile();
      const context = makeContext();

      const candidates = await service.generateCandidates({ profile, context });
      expect(candidates).toEqual([]);
    });
  });

  // ─── Window type matching ─────────────────────────────────────────────────

  describe('window type matching', () => {
    it('should include items with ANY in suitableWindows regardless of context', async () => {
      const profile = makeProfile();
      const context = makeContext({
        freeWindows: [makeWindow('MORNING_START', 60)],
        opportunityWindows: [makeWindow('MORNING_START', 60)],
      });

      const anyItem = makeItem({ suitableWindows: ['ANY'], durationMinutes: 45, minDurationMinutes: 30 });
      catalogService.getCatalogItems.mockResolvedValue([anyItem]);

      const candidates = await service.generateCandidates({ profile, context });
      expect(candidates.length).toBe(1);
    });

    it('should filter out items whose suitableWindows do not match context', async () => {
      const profile = makeProfile();
      const context = makeContext({
        freeWindows: [makeWindow('MORNING_START', 90)],
        opportunityWindows: [makeWindow('MORNING_START', 90)],
      });

      // DINNER only item — no evening context
      const dinnerItem = makeItem({ suitableWindows: ['DINNER'], durationMinutes: 90, minDurationMinutes: 60 });
      catalogService.getCatalogItems.mockResolvedValue([dinnerItem]);

      const candidates = await service.generateCandidates({ profile, context });
      expect(candidates.length).toBe(0);
    });
  });
});
