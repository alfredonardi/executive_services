import { apiClient } from './api.client';

export interface RecommendationReason {
  code: string;
  label: string;
  detail?: string;
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
