import { Injectable, Logger } from '@nestjs/common';
import { RecommendationCategory } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { RecommendationResponse, RecommendationResult } from '../domain/recommendation-result.model';
import { ScheduleContextService } from './schedule-context.service';
import { PreferenceProfileService } from './preference-profile.service';
import { RecommendationCandidateService } from './recommendation-candidate.service';
import { RecommendationRankingService } from './recommendation-ranking.service';
import { RecommendationExplanationService } from './recommendation-explanation.service';

const MAX_RESULTS = 8;
/** Fallback duration (minutes) when a catalog item has no explicit duration set. */
const DEFAULT_DURATION_MINUTES = 30;

@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduleContextService: ScheduleContextService,
    private readonly preferenceProfileService: PreferenceProfileService,
    private readonly candidateService: RecommendationCandidateService,
    private readonly rankingService: RecommendationRankingService,
    private readonly explanationService: RecommendationExplanationService,
  ) {}

  async getRecommendations(
    userId: string,
    options: { windowStart?: Date; windowEnd?: Date },
  ): Promise<RecommendationResponse> {
    const now = new Date();
    const windowStart = options.windowStart ?? now;
    const windowEnd = options.windowEnd ?? new Date(now.getTime() + 24 * 60 * 60 * 1000);

    this.logger.log(
      `Getting recommendations for user ${userId} — window: ${windowStart.toISOString()} to ${windowEnd.toISOString()}`,
    );

    // 1. Preference profile
    const profile = await this.preferenceProfileService.getOrCreateDefault(userId);

    // 2. Schedule context
    const context = await this.scheduleContextService.deriveContext(
      userId,
      windowStart,
      'America/Sao_Paulo',
    );

    // 3. Generate candidates
    const candidates = await this.candidateService.generateCandidates({
      profile,
      context,
      requestedWindow: { start: windowStart, end: windowEnd },
    });

    // 4. Rank candidates
    const ranked = await this.rankingService.rankCandidates(candidates, profile, context);

    // 5. Take top MAX_RESULTS and build results with explanations
    const top = ranked.slice(0, MAX_RESULTS);

    const recommendations: RecommendationResult[] = top.map((rc) => {
      const reasons = this.explanationService.explainRecommendation(
        rc.item,
        profile,
        context,
        rc.normalizedScore,
      );

      return {
        id: rc.item.id,
        catalogItemId: rc.item.id,
        category: rc.item.category as RecommendationCategory,
        title: rc.item.title,
        summary: rc.item.description,
        neighborhood: rc.item.neighborhood ?? null,
        estimatedDurationMinutes: rc.item.durationMinutes ?? rc.item.minDurationMinutes ?? DEFAULT_DURATION_MINUTES,
        suitableWindows: rc.item.suitableWindows,
        relevanceScore: rc.normalizedScore,
        reasons,
        cautionNotes: this.buildCautionNotes(rc.item, context),
        sourceType: rc.item.sourceType,
        priceLevel: rc.item.priceLevel,
        premiumScore: rc.item.premiumScore,
        tags: rc.item.tags,
        imageUrl: rc.item.imageUrl ?? null,
        websiteUrl: rc.item.websiteUrl ?? null,
      };
    });

    // 6. Save session
    const session = await this.prisma.recommendationSession.create({
      data: {
        userId,
        windowStart,
        windowEnd,
        contextSnapshot: {
          scheduleDensity: context.scheduleDensity,
          freeWindowCount: context.freeWindows.length,
          hasMealOpportunity: context.hasMealOpportunity,
          hasEveningFree: context.hasEveningFree,
        },
        resultsSnapshot: recommendations.map((r) => ({
          catalogItemId: r.catalogItemId,
          title: r.title,
          relevanceScore: r.relevanceScore,
        })),
      },
    });

    return {
      sessionId: session.id,
      userId,
      requestedAt: session.requestedAt,
      windowStart,
      windowEnd,
      scheduleDensity: context.scheduleDensity,
      recommendations,
    };
  }

  async getRecentSessions(userId: string, limit = 10) {
    return this.prisma.recommendationSession.findMany({
      where: { userId },
      orderBy: { requestedAt: 'desc' },
      take: limit,
    });
  }

  private buildCautionNotes(
    item: { durationMinutes: number | null; minDurationMinutes: number; priceLevel: number },
    context: { scheduleDensity: string; freeWindows: { durationMinutes: number }[] },
  ): string[] {
    const notes: string[] = [];

    if (context.scheduleDensity === 'high') {
      notes.push('Your schedule is packed today — check your calendar before booking.');
    }

    const duration = item.durationMinutes ?? item.minDurationMinutes ?? DEFAULT_DURATION_MINUTES;
    const maxFree =
      context.freeWindows.length > 0
        ? Math.max(...context.freeWindows.map((w) => w.durationMinutes))
        : 999;

    if (duration > maxFree - 15) {
      notes.push(
        'This experience may be tight given your current free windows. Allow buffer time.',
      );
    }

    if (item.priceLevel >= 4) {
      notes.push('Premium venue — advance reservation recommended.');
    }

    return notes;
  }
}
