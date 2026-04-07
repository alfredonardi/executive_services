import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RecommendationService } from './services/recommendation.service';
import { PreferenceProfileService } from './services/preference-profile.service';
import { RecommendationFeedbackService } from './services/recommendation-feedback.service';
import {
  GetRecommendationsQueryDto,
  PreferenceProfileResponseDto,
  RecommendationFeedbackDto,
  RecommendationFeedbackResponseDto,
  RecommendationResponseDto,
  RecommendationSessionSummaryDto,
  UpsertPreferenceProfileDto,
} from './dto/recommendation.dto';

@ApiTags('Recommendations')
@ApiBearerAuth()
@Controller('recommendations')
export class RecommendationController {
  private readonly logger = new Logger(RecommendationController.name);

  constructor(
    private readonly recommendationService: RecommendationService,
    private readonly preferenceProfileService: PreferenceProfileService,
    private readonly feedbackService: RecommendationFeedbackService,
  ) {}

  // ─── Preference Profile ────────────────────────────────────────────────────

  @Get('profile')
  @ApiOperation({ summary: 'Get the preference profile for the authenticated user' })
  @ApiResponse({ status: 200, type: PreferenceProfileResponseDto })
  @ApiResponse({ status: 200, description: 'Returns null if no profile exists yet' })
  async getProfile(
    @CurrentUser('id') userId: string,
  ): Promise<PreferenceProfileResponseDto | null> {
    const profile = await this.preferenceProfileService.getProfile(userId);
    return profile as PreferenceProfileResponseDto | null;
  }

  @Post('profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create or update the preference profile for the authenticated user' })
  @ApiResponse({ status: 200, type: PreferenceProfileResponseDto })
  async upsertProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpsertPreferenceProfileDto,
  ): Promise<PreferenceProfileResponseDto> {
    const profile = await this.preferenceProfileService.upsertProfile(userId, dto);
    return profile as PreferenceProfileResponseDto;
  }

  // ─── Recommendations ────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({
    summary: 'Get personalized recommendations for the authenticated user',
    description:
      'Derives schedule context from calendar, applies preference profile, and returns ranked recommendations. Pass `from`/`to` to specify the time window.',
  })
  @ApiResponse({ status: 200, type: RecommendationResponseDto })
  async getRecommendations(
    @CurrentUser('id') userId: string,
    @Query() query: GetRecommendationsQueryDto,
  ): Promise<RecommendationResponseDto> {
    const result = await this.recommendationService.getRecommendations(userId, {
      windowStart: query.from ? new Date(query.from) : undefined,
      windowEnd: query.to ? new Date(query.to) : undefined,
    });
    return result as RecommendationResponseDto;
  }

  // ─── Feedback ──────────────────────────────────────────────────────────────

  @Post('feedback')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit feedback on a recommendation' })
  @ApiResponse({ status: 201, type: RecommendationFeedbackResponseDto })
  async submitFeedback(
    @CurrentUser('id') userId: string,
    @Body() dto: RecommendationFeedbackDto,
  ): Promise<RecommendationFeedbackResponseDto> {
    const feedback = await this.feedbackService.recordFeedback(
      userId,
      dto.sessionId,
      dto.catalogItemId,
      dto.action,
      dto.reason,
    );
    return feedback as RecommendationFeedbackResponseDto;
  }

  // ─── Sessions ──────────────────────────────────────────────────────────────

  @Get('sessions')
  @ApiOperation({ summary: 'List recent recommendation sessions for the authenticated user' })
  @ApiResponse({ status: 200, type: [RecommendationSessionSummaryDto] })
  async getSessions(
    @CurrentUser('id') userId: string,
  ): Promise<RecommendationSessionSummaryDto[]> {
    const sessions = await this.recommendationService.getRecentSessions(userId);
    return sessions as unknown as RecommendationSessionSummaryDto[];
  }
}
