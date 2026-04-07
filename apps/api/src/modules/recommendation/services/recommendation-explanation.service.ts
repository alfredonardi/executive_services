import { Injectable } from '@nestjs/common';
import { PreferenceProfile, Recommendation, RecommendationCategory } from '@prisma/client';
import { RecommendationReason } from '../domain/recommendation-result.model';
import { ScheduleContext } from '../domain/schedule-context.model';

@Injectable()
export class RecommendationExplanationService {
  explainRecommendation(
    candidate: Recommendation,
    profile: PreferenceProfile,
    context: ScheduleContext,
    score: number,
  ): RecommendationReason[] {
    const reasons: RecommendationReason[] = [];

    if (profile.preferredCategories.includes(candidate.category)) {
      reasons.push({
        code: 'PREFERRED_CATEGORY',
        label: 'Matches your preferred category',
        detail: `You have marked ${candidate.category.toLowerCase().replace(/_/g, ' ')} as a preferred category.`,
      });
    }

    if (context.hasMealOpportunity && this.isMealSuitable(candidate)) {
      reasons.push({
        code: 'MEAL_WINDOW_FIT',
        label: 'Fits your lunch window',
        detail: 'A suitable lunch window was detected in your schedule today.',
      });
    }

    if (
      profile.preferredNeighborhoods.length > 0 &&
      candidate.neighborhood &&
      profile.preferredNeighborhoods.some(
        (n) => n.toLowerCase() === candidate.neighborhood!.toLowerCase(),
      )
    ) {
      reasons.push({
        code: 'PREFERRED_NEIGHBORHOOD',
        label: 'Located in your preferred area',
        detail: `${candidate.neighborhood} is one of your preferred neighborhoods.`,
      });
    }

    if (profile.wellnessInterest && candidate.category === RecommendationCategory.WELLNESS) {
      reasons.push({
        code: 'WELLNESS_MATCH',
        label: 'Matches your wellness interest',
        detail: 'You have indicated interest in wellness activities.',
      });
    }

    if ((candidate.premiumScore ?? 0) >= 4) {
      reasons.push({
        code: 'PREMIUM_QUALITY',
        label: 'Highly curated premium venue',
        detail: `This venue has a premium score of ${candidate.premiumScore}/5.`,
      });
    }

    const durationFits = this.checkDurationFit(candidate, context);
    if (durationFits) {
      reasons.push({
        code: 'DURATION_FIT',
        label: 'Fits within your available time',
        detail: `This experience takes approximately ${candidate.durationMinutes ?? candidate.minDurationMinutes} minutes.`,
      });
    }

    if (context.opportunityWindows.length > 0) {
      reasons.push({
        code: 'SCHEDULE_GAP',
        label: 'Good fit for your current schedule gap',
        detail: `You have ${context.opportunityWindows.length} opportunity window(s) today.`,
      });
    }

    if (profile.businessTravelStyle === 'premium' && (candidate.priceLevel ?? 0) >= 3) {
      reasons.push({
        code: 'BUSINESS_TRAVEL_FIT',
        label: 'Well-suited for business travelers',
        detail: 'Matches your premium business travel style preference.',
      });
    }

    // Ensure at least one reason
    if (reasons.length === 0) {
      reasons.push({
        code: 'SCHEDULE_GAP',
        label: 'Available during your schedule',
        detail: 'This option fits within your available time today.',
      });
    }

    return reasons;
  }

  private isMealSuitable(candidate: Recommendation): boolean {
    return (
      candidate.suitableWindows.includes('LUNCH') ||
      candidate.suitableWindows.includes('DINNER') ||
      candidate.suitableWindows.includes('ANY') ||
      candidate.category === RecommendationCategory.RESTAURANT
    );
  }

  private checkDurationFit(candidate: Recommendation, context: ScheduleContext): boolean {
    const itemDuration = candidate.durationMinutes ?? candidate.minDurationMinutes ?? 30;
    const allWindows = [...context.freeWindows, ...context.opportunityWindows];
    if (allWindows.length === 0) return true; // no constraint info

    return allWindows.some((w) => w.durationMinutes >= itemDuration);
  }
}
