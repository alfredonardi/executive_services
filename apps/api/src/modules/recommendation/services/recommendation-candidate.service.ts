import { Injectable, Logger } from '@nestjs/common';
import { PreferenceProfile, Recommendation } from '@prisma/client';
import { ScheduleContext } from '../domain/schedule-context.model';
import { RecommendationCatalogService } from './recommendation-catalog.service';

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
export class RecommendationCandidateService {
  private readonly logger = new Logger(RecommendationCandidateService.name);

  constructor(private readonly catalogService: RecommendationCatalogService) {}

  async generateCandidates(options: {
    profile: PreferenceProfile;
    context: ScheduleContext;
    requestedWindow?: { start: Date; end: Date };
  }): Promise<Recommendation[]> {
    const { profile, context, requestedWindow } = options;

    const allItems = await this.catalogService.getCatalogItems({ isActive: true });

    this.logger.debug(`Filtering ${allItems.length} catalog items for user ${profile.userId}`);

    const availableWindowDuration = this.computeMaxAvailableDuration(context, requestedWindow);
    const contextWindowTypes = this.collectContextWindowTypes(context);

    const candidates = allItems.filter((item) => {
      // Filter: disliked category
      if (profile.dislikedCategories.includes(item.category)) {
        return false;
      }

      // Filter: item requires more time than any available window
      const minRequired = item.minDurationMinutes ?? item.durationMinutes ?? 20;
      if (minRequired > availableWindowDuration) {
        return false;
      }

      // Filter: no suitable window matches the context
      if (item.suitableWindows.length > 0) {
        const hasMatchingWindow = item.suitableWindows.some((sw) => {
          const mapped = SUITABLE_WINDOW_TO_CONTEXT_MAP[sw] ?? [];
          return mapped.some((wt) => contextWindowTypes.has(wt));
        });
        if (!hasMatchingWindow) {
          return false;
        }
      }

      return true;
    });

    this.logger.debug(`${candidates.length} candidates after filtering`);
    return candidates;
  }

  private computeMaxAvailableDuration(
    context: ScheduleContext,
    requestedWindow?: { start: Date; end: Date },
  ): number {
    if (requestedWindow) {
      return Math.round(
        (requestedWindow.end.getTime() - requestedWindow.start.getTime()) / 60_000,
      );
    }

    const allFree = [
      ...context.freeWindows,
      ...context.opportunityWindows,
    ];

    if (allFree.length === 0) {
      // No calendar data — assume flexible day, use preference max
      return 120;
    }

    return Math.max(...allFree.map((w) => w.durationMinutes));
  }

  private collectContextWindowTypes(context: ScheduleContext): Set<string> {
    const types = new Set<string>();
    for (const w of [...context.freeWindows, ...context.opportunityWindows]) {
      types.add(w.type);
    }

    // Always include ANY context types for flexibility
    if (context.freeWindows.length === 0 && context.occupiedWindows.length === 0) {
      types.add('FREE');
      types.add('ANY');
    }

    return types;
  }
}
