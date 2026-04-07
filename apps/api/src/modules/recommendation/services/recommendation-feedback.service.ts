import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { RecommendationFeedback } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

const VALID_ACTIONS = ['HELPFUL', 'NOT_HELPFUL', 'SAVED', 'DISMISSED', 'ACTED_ON'] as const;
type FeedbackAction = (typeof VALID_ACTIONS)[number];

@Injectable()
export class RecommendationFeedbackService {
  private readonly logger = new Logger(RecommendationFeedbackService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recordFeedback(
    userId: string,
    sessionId: string,
    catalogItemId: string,
    action: string,
    reason?: string,
  ): Promise<RecommendationFeedback> {
    if (!VALID_ACTIONS.includes(action as FeedbackAction)) {
      throw new BadRequestException(
        `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}`,
      );
    }

    this.logger.log(
      `Recording feedback: user=${userId} session=${sessionId} item=${catalogItemId} action=${action}`,
    );

    return this.prisma.recommendationFeedback.create({
      data: {
        userId,
        sessionId,
        catalogItemId,
        action,
        reason: reason ?? null,
      },
    });
  }

  async getFeedbackHistory(userId: string, limit = 50): Promise<RecommendationFeedback[]> {
    return this.prisma.recommendationFeedback.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
