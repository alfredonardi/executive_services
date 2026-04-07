import { Test, TestingModule } from '@nestjs/testing';
import { RecommendationController } from '../recommendation.controller';
import { RecommendationService } from '../services/recommendation.service';
import { PreferenceProfileService } from '../services/preference-profile.service';
import { RecommendationFeedbackService } from '../services/recommendation-feedback.service';
import { RecommendationCategory } from '@prisma/client';

const mockUserId = 'user-test-1';

const mockProfile = {
  id: 'profile-1',
  userId: mockUserId,
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
};

const mockRecommendationResponse = {
  sessionId: 'session-1',
  userId: mockUserId,
  requestedAt: new Date(),
  windowStart: new Date(),
  windowEnd: new Date(),
  scheduleDensity: 'low',
  recommendations: [],
};

const mockFeedback = {
  id: 'feedback-1',
  sessionId: 'session-1',
  userId: mockUserId,
  catalogItemId: 'item-1',
  action: 'HELPFUL',
  reason: null,
  createdAt: new Date(),
};

describe('RecommendationController', () => {
  let controller: RecommendationController;
  let recommendationService: jest.Mocked<RecommendationService>;
  let preferenceProfileService: jest.Mocked<PreferenceProfileService>;
  let feedbackService: jest.Mocked<RecommendationFeedbackService>;

  beforeEach(async () => {
    const mockRecommendationService = {
      getRecommendations: jest.fn().mockResolvedValue(mockRecommendationResponse),
      getRecentSessions: jest.fn().mockResolvedValue([]),
    };

    const mockPreferenceProfileService = {
      getProfile: jest.fn().mockResolvedValue(mockProfile),
      upsertProfile: jest.fn().mockResolvedValue(mockProfile),
    };

    const mockFeedbackService = {
      recordFeedback: jest.fn().mockResolvedValue(mockFeedback),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RecommendationController],
      providers: [
        { provide: RecommendationService, useValue: mockRecommendationService },
        { provide: PreferenceProfileService, useValue: mockPreferenceProfileService },
        { provide: RecommendationFeedbackService, useValue: mockFeedbackService },
      ],
    }).compile();

    controller = module.get<RecommendationController>(RecommendationController);
    recommendationService = module.get(RecommendationService);
    preferenceProfileService = module.get(PreferenceProfileService);
    feedbackService = module.get(RecommendationFeedbackService);
  });

  // ─── GET /recommendations/profile ─────────────────────────────────────────

  describe('GET /recommendations/profile', () => {
    it('should return the preference profile for the user', async () => {
      const result = await controller.getProfile(mockUserId);
      expect(result).toEqual(mockProfile);
      expect(preferenceProfileService.getProfile).toHaveBeenCalledWith(mockUserId);
    });

    it('should return null when no profile exists', async () => {
      preferenceProfileService.getProfile.mockResolvedValue(null);
      const result = await controller.getProfile(mockUserId);
      expect(result).toBeNull();
    });
  });

  // ─── POST /recommendations/profile ────────────────────────────────────────

  describe('POST /recommendations/profile', () => {
    it('should create or update the profile and return it', async () => {
      const dto = {
        wellnessInterest: true,
        preferredCategories: [RecommendationCategory.WELLNESS],
        preferredNeighborhoods: ['Jardins'],
      };

      const result = await controller.upsertProfile(mockUserId, dto as any);
      expect(result).toEqual(mockProfile);
      expect(preferenceProfileService.upsertProfile).toHaveBeenCalledWith(mockUserId, dto);
    });
  });

  // ─── GET /recommendations ─────────────────────────────────────────────────

  describe('GET /recommendations', () => {
    it('should return recommendations response', async () => {
      const result = await controller.getRecommendations(mockUserId, {});
      expect(result).toEqual(mockRecommendationResponse);
      expect(recommendationService.getRecommendations).toHaveBeenCalledWith(mockUserId, {
        windowStart: undefined,
        windowEnd: undefined,
      });
    });

    it('should pass parsed dates from query params', async () => {
      const from = '2026-04-07T09:00:00Z';
      const to = '2026-04-07T22:00:00Z';
      await controller.getRecommendations(mockUserId, { from, to });

      expect(recommendationService.getRecommendations).toHaveBeenCalledWith(mockUserId, {
        windowStart: new Date(from),
        windowEnd: new Date(to),
      });
    });
  });

  // ─── POST /recommendations/feedback ──────────────────────────────────────

  describe('POST /recommendations/feedback', () => {
    it('should record feedback and return it', async () => {
      const dto = {
        sessionId: 'session-1',
        catalogItemId: 'item-1',
        action: 'HELPFUL',
        reason: 'Great suggestion',
      };

      const result = await controller.submitFeedback(mockUserId, dto);
      expect(result).toEqual(mockFeedback);
      expect(feedbackService.recordFeedback).toHaveBeenCalledWith(
        mockUserId,
        dto.sessionId,
        dto.catalogItemId,
        dto.action,
        dto.reason,
      );
    });

    it('should record feedback without reason', async () => {
      const dto = {
        sessionId: 'session-1',
        catalogItemId: 'item-1',
        action: 'DISMISSED',
      };

      await controller.submitFeedback(mockUserId, dto as any);
      expect(feedbackService.recordFeedback).toHaveBeenCalledWith(
        mockUserId,
        dto.sessionId,
        dto.catalogItemId,
        dto.action,
        undefined,
      );
    });
  });

  // ─── GET /recommendations/sessions ───────────────────────────────────────

  describe('GET /recommendations/sessions', () => {
    it('should return recent recommendation sessions', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          userId: mockUserId,
          windowStart: new Date(),
          windowEnd: new Date(),
          requestedAt: new Date(),
          contextSnapshot: {},
          resultsSnapshot: [],
        },
      ];
      recommendationService.getRecentSessions.mockResolvedValue(mockSessions as any);

      const result = await controller.getSessions(mockUserId);
      expect(result).toEqual(mockSessions);
      expect(recommendationService.getRecentSessions).toHaveBeenCalledWith(mockUserId);
    });
  });
});
