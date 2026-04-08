import { Module } from '@nestjs/common';
import { CalendarModule } from '../calendar/calendar.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { RecommendationController } from './recommendation.controller';
import { RecommendationService } from './services/recommendation.service';
import { ScheduleContextService } from './services/schedule-context.service';
import { PreferenceProfileService } from './services/preference-profile.service';
import { RecommendationCatalogService } from './services/recommendation-catalog.service';
import { RecommendationCandidateService } from './services/recommendation-candidate.service';
import { RecommendationRankingService } from './services/recommendation-ranking.service';
import { RecommendationExplanationService } from './services/recommendation-explanation.service';
import { RecommendationFeedbackService } from './services/recommendation-feedback.service';

@Module({
  imports: [PrismaModule, CalendarModule],
  controllers: [RecommendationController],
  providers: [
    RecommendationService,
    ScheduleContextService,
    PreferenceProfileService,
    RecommendationCatalogService,
    RecommendationCandidateService,
    RecommendationRankingService,
    RecommendationExplanationService,
    RecommendationFeedbackService,
  ],
  exports: [RecommendationService, ScheduleContextService, PreferenceProfileService],
})
export class RecommendationModule {}
