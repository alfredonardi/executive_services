import { RecommendationCategory } from '@prisma/client';

export interface RecommendationReason {
  code: string;
  label: string;
  detail?: string;
}

export interface RecommendationResult {
  id: string;
  catalogItemId: string;
  category: RecommendationCategory;
  title: string;
  summary: string;
  neighborhood: string | null;
  estimatedDurationMinutes: number;
  suitableWindows: string[];
  relevanceScore: number;
  reasons: RecommendationReason[];
  cautionNotes: string[];
  sourceType: string;
  priceLevel: number;
  premiumScore: number;
  tags: string[];
  imageUrl: string | null;
  websiteUrl: string | null;
}

export interface RecommendationResponse {
  sessionId: string;
  userId: string;
  requestedAt: Date;
  windowStart: Date;
  windowEnd: Date;
  scheduleDensity: string;
  recommendations: RecommendationResult[];
}
