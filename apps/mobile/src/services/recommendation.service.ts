import { apiClient } from './api.client';

export interface RecommendationReason {
  code: string;
  label: string;
  detail?: string;
}

export type RecommendationCategory =
  | 'RESTAURANT'
  | 'WELLNESS'
  | 'SHORT_EXPERIENCE'
  | 'BUSINESS_SUPPORT'
  | 'MICRO_EXPERIENCE';

export interface PreferenceProfile {
  id: string;
  userId: string;
  foodPreferences: string[];
  dietaryConstraints: string[];
  atmospherePreferences: string[];
  preferredCategories: RecommendationCategory[];
  dislikedCategories: RecommendationCategory[];
  preferredDurationMin: number;
  preferredDurationMax: number;
  mobilityTolerance: string;
  preferredNeighborhoods: string[];
  pacing: string;
  wellnessInterest: boolean;
  businessTravelStyle: string;
  additionalNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertPreferenceProfileDto {
  foodPreferences?: string[];
  dietaryConstraints?: string[];
  atmospherePreferences?: string[];
  preferredCategories?: RecommendationCategory[];
  dislikedCategories?: RecommendationCategory[];
  preferredDurationMin?: number;
  preferredDurationMax?: number;
  mobilityTolerance?: string;
  preferredNeighborhoods?: string[];
  pacing?: string;
  wellnessInterest?: boolean;
  businessTravelStyle?: string;
  additionalNotes?: string;
}

export interface RecommendationResult {
  id: string;
  catalogItemId: string;
  category: string;
  title: string;
  summary: string;
  neighborhood: string | null;
  estimatedDurationMinutes: number;
  suitableWindows: string[];
  relevanceScore: number;
  reasons: RecommendationReason[];
  priceLevel: number;
  tags: string[];
  imageUrl: string | null;
  websiteUrl: string | null;
}

export interface RecommendationResponse {
  sessionId: string;
  userId: string;
  requestedAt: string;
  windowStart: string;
  windowEnd: string;
  scheduleDensity: 'low' | 'moderate' | 'high';
  recommendations: RecommendationResult[];
}

export type FeedbackAction = 'SAVED' | 'DISMISSED' | 'ACTED' | 'VIEWED';

export const recommendationService = {
  async getPreferenceProfile(): Promise<PreferenceProfile | null> {
    const response = await apiClient.get<PreferenceProfile | null>('/recommendations/profile');
    return response.data;
  },

  async upsertPreferenceProfile(
    dto: UpsertPreferenceProfileDto,
  ): Promise<PreferenceProfile> {
    const response = await apiClient.post<PreferenceProfile>('/recommendations/profile', dto);
    return response.data;
  },

  async getRecommendations(): Promise<RecommendationResponse> {
    const response = await apiClient.get<RecommendationResponse>('/recommendations');
    return response.data;
  },

  async submitFeedback(
    sessionId: string,
    catalogItemId: string,
    action: FeedbackAction,
    reason?: string,
  ): Promise<void> {
    await apiClient.post('/recommendations/feedback', {
      sessionId,
      catalogItemId,
      action,
      reason,
    });
  },
};
