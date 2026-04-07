import { Injectable, Logger } from '@nestjs/common';
import { PreferenceProfile, Recommendation, RecommendationCategory } from '@prisma/client';
import { ScheduleContext } from '../domain/schedule-context.model';

export interface RankedCandidate {
  item: Recommendation;
  rawScore: number;
  normalizedScore: number;
  scoreBreakdown: {
    categoryFit: number;
    timingFit: number;
    durationFit: number;
    neighborhoodFit: number;
    premiumRelevance: number;
    wellnessBonus: number;
    diversityPenalty: number;
    businessTravelFit: number;
  };
}

const SUITABLE_WINDOW_TO_CONTEXT_MAP: Record<string, string[]> = {
  BREAKFAST: ['MORNING_START', 'MORNING'],
  MORNING: ['MORNING_START', 'FREE', 'POST_MEETING'],
  LUNCH: ['MEAL_OPPORTUNITY'],
  AFTER_MEETING: ['POST_MEETING', 'FREE'],
  AFTERNOON: ['FREE', 'POST_MEETING', 'PRE_MEETING'],
  DINNER: ['EVENING_FREE'],
  EVENING: ['EVENING_FREE', 'FREE'],
  ANY: ['FREE', 'MEAL_OPPORTUNITY', 'MORNING_START', 'EVENING_FREE', 'POST_MEETING', 'PRE_MEETING'],
};

@Injectable()
export class RecommendationRankingService {
  private readonly logger = new Logger(RecommendationRankingService.name);

  async rankCandidates(
    candidates: Recommendation[],
    profile: PreferenceProfile,
    context: ScheduleContext,
  ): Promise<RankedCandidate[]> {
    this.logger.debug(`Ranking ${candidates.length} candidates`);

    const categoryCount = new Map<RecommendationCategory, number>();
    const scored: Array<{ item: Recommendation; breakdown: RankedCandidate['scoreBreakdown']; raw: number }> = [];

    for (const item of candidates) {
      const breakdown = this.scoreItem(item, profile, context, categoryCount);
      const raw = Object.values(breakdown).reduce((sum, v) => sum + v, 0);
      scored.push({ item, breakdown, raw });
      // Update category count for diversity penalty
      categoryCount.set(item.category, (categoryCount.get(item.category) ?? 0) + 1);
    }

    // Re-rank from scratch with proper diversity penalty (rank-dependent)
    categoryCount.clear();
    const ranked: RankedCandidate[] = [];

    // Sort by raw score descending first, then apply diversity penalty
    scored.sort((a, b) => b.raw - a.raw);

    for (const entry of scored) {
      const diversityPenalty = (categoryCount.get(entry.item.category) ?? 0) > 0 ? -10 : 0;
      const finalRaw = entry.raw + diversityPenalty;

      ranked.push({
        item: entry.item,
        rawScore: finalRaw,
        normalizedScore: 0, // filled in after
        scoreBreakdown: { ...entry.breakdown, diversityPenalty },
      });

      categoryCount.set(entry.item.category, (categoryCount.get(entry.item.category) ?? 0) + 1);
    }

    // Normalize scores to 0-100
    const scores = ranked.map((r) => r.rawScore);
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const range = maxScore - minScore;

    for (const r of ranked) {
      r.normalizedScore = range === 0 ? 100 : Math.round(((r.rawScore - minScore) / range) * 100);
    }

    return ranked.sort((a, b) => b.normalizedScore - a.normalizedScore);
  }

  private scoreItem(
    item: Recommendation,
    profile: PreferenceProfile,
    context: ScheduleContext,
    existingCategoryCount: Map<RecommendationCategory, number>,
  ): RankedCandidate['scoreBreakdown'] {
    return {
      categoryFit: this.scoreCategoryFit(item, profile),
      timingFit: this.scoreTimingFit(item, context),
      durationFit: this.scoreDurationFit(item, context),
      neighborhoodFit: this.scoreNeighborhoodFit(item, profile),
      premiumRelevance: this.scorePremiumRelevance(item),
      wellnessBonus: this.scoreWellnessBonus(item, profile),
      diversityPenalty: 0, // applied post-ranking
      businessTravelFit: this.scoreBusinessTravelFit(item, profile),
    };
  }

  /** 0-25 pts: +25 if preferred, -50 if disliked, 0 otherwise */
  private scoreCategoryFit(item: Recommendation, profile: PreferenceProfile): number {
    if (profile.preferredCategories.includes(item.category)) return 25;
    if (profile.dislikedCategories.includes(item.category)) return -50;
    return 0;
  }

  /** 0-20 pts: match suitableWindows against context opportunity window types */
  private scoreTimingFit(item: Recommendation, context: ScheduleContext): number {
    if (item.suitableWindows.length === 0) return 10; // no preference = neutral

    const contextTypes = new Set<string>(
      [...context.freeWindows, ...context.opportunityWindows].map((w) => w.type),
    );

    let matches = 0;
    for (const sw of item.suitableWindows) {
      const mapped = SUITABLE_WINDOW_TO_CONTEXT_MAP[sw] ?? [];
      if (mapped.some((wt) => contextTypes.has(wt))) {
        matches++;
      }
    }

    if (matches === 0) return 0;
    return Math.min(20, Math.round((matches / item.suitableWindows.length) * 20));
  }

  /** 0-15 pts: how well the item's duration fits available free windows */
  private scoreDurationFit(item: Recommendation, context: ScheduleContext): number {
    const itemDuration = item.durationMinutes ?? item.minDurationMinutes ?? 30;

    const allWindows = [...context.freeWindows, ...context.opportunityWindows];
    if (allWindows.length === 0) return 10; // no data = neutral

    const bestFit = allWindows.reduce((best, w) => {
      const slack = w.durationMinutes - itemDuration;
      if (slack < 0) return best; // doesn't fit
      const fitScore = slack <= 15 ? 15 : slack <= 30 ? 12 : 8; // closer fit = higher score
      return Math.max(best, fitScore);
    }, 0);

    return bestFit;
  }

  /** 0-15 pts: neighborhood match */
  private scoreNeighborhoodFit(item: Recommendation, profile: PreferenceProfile): number {
    if (profile.preferredNeighborhoods.length === 0) return 5; // flexible = small bonus

    const itemNeighborhood = item.neighborhood?.toLowerCase() ?? '';
    const isPreferred = profile.preferredNeighborhoods.some(
      (n) => n.toLowerCase() === itemNeighborhood,
    );
    return isPreferred ? 15 : 0;
  }

  /** 0-10 pts: premiumScore × 2 */
  private scorePremiumRelevance(item: Recommendation): number {
    return (item.premiumScore ?? 3) * 2;
  }

  /** 0-10 pts: wellness interest bonus */
  private scoreWellnessBonus(item: Recommendation, profile: PreferenceProfile): number {
    if (profile.wellnessInterest && item.category === RecommendationCategory.WELLNESS) return 10;
    return 0;
  }

  /** 0-5 pts: business travel style fit */
  private scoreBusinessTravelFit(item: Recommendation, profile: PreferenceProfile): number {
    const style = profile.businessTravelStyle ?? 'premium';

    if (style === 'premium' && item.priceLevel >= 3) return 5;
    if (style === 'efficient' && item.durationMinutes !== null && item.durationMinutes <= 60) return 5;
    if (style === 'experience' && item.premiumScore >= 4) return 5;
    if (style === 'budget' && item.priceLevel <= 2) return 5;
    return 2; // partial match
  }
}
