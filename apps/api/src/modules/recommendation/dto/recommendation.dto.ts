import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RecommendationCategory } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

// ─── Preference Profile ───────────────────────────────────────────────────────

export class UpsertPreferenceProfileDto {
  @ApiPropertyOptional({ type: [String], example: ['italian', 'japanese'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  foodPreferences?: string[];

  @ApiPropertyOptional({ type: [String], example: ['vegetarian'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dietaryConstraints?: string[];

  @ApiPropertyOptional({ type: [String], example: ['quiet', 'private'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  atmospherePreferences?: string[];

  @ApiPropertyOptional({ enum: RecommendationCategory, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(RecommendationCategory, { each: true })
  preferredCategories?: RecommendationCategory[];

  @ApiPropertyOptional({ enum: RecommendationCategory, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(RecommendationCategory, { each: true })
  dislikedCategories?: RecommendationCategory[];

  @ApiPropertyOptional({ example: 30, minimum: 10, maximum: 240 })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(240)
  @Type(() => Number)
  preferredDurationMin?: number;

  @ApiPropertyOptional({ example: 90, minimum: 10, maximum: 480 })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(480)
  @Type(() => Number)
  preferredDurationMax?: number;

  @ApiPropertyOptional({ example: 'moderate', enum: ['low', 'moderate', 'high'] })
  @IsOptional()
  @IsString()
  mobilityTolerance?: string;

  @ApiPropertyOptional({ type: [String], example: ['Jardins', 'Itaim Bibi'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredNeighborhoods?: string[];

  @ApiPropertyOptional({ example: 'efficient', enum: ['relaxed', 'efficient', 'exploratory'] })
  @IsOptional()
  @IsString()
  pacing?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  wellnessInterest?: boolean;

  @ApiPropertyOptional({
    example: 'premium',
    enum: ['budget', 'efficient', 'premium', 'experience'],
  })
  @IsOptional()
  @IsString()
  businessTravelStyle?: string;

  @ApiPropertyOptional({ example: 'Prefer rooftop venues when available' })
  @IsOptional()
  @IsString()
  additionalNotes?: string;
}

export class PreferenceProfileResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  userId!: string;

  @ApiProperty({ type: [String] })
  foodPreferences!: string[];

  @ApiProperty({ type: [String] })
  dietaryConstraints!: string[];

  @ApiProperty({ type: [String] })
  atmospherePreferences!: string[];

  @ApiProperty({ enum: RecommendationCategory, isArray: true })
  preferredCategories!: RecommendationCategory[];

  @ApiProperty({ enum: RecommendationCategory, isArray: true })
  dislikedCategories!: RecommendationCategory[];

  @ApiProperty({ example: 30 })
  preferredDurationMin!: number;

  @ApiProperty({ example: 90 })
  preferredDurationMax!: number;

  @ApiProperty({ example: 'moderate' })
  mobilityTolerance!: string;

  @ApiProperty({ type: [String] })
  preferredNeighborhoods!: string[];

  @ApiProperty({ example: 'efficient' })
  pacing!: string;

  @ApiProperty({ example: false })
  wellnessInterest!: boolean;

  @ApiProperty({ example: 'premium' })
  businessTravelStyle!: string;

  @ApiPropertyOptional({ example: 'Prefer rooftop venues' })
  additionalNotes?: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

// ─── Get Recommendations ──────────────────────────────────────────────────────

export class GetRecommendationsQueryDto {
  @ApiPropertyOptional({
    description: 'Start of recommendation window (ISO 8601)',
    example: '2026-04-07T09:00:00Z',
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({
    description: 'End of recommendation window (ISO 8601)',
    example: '2026-04-07T22:00:00Z',
  })
  @IsOptional()
  @IsISO8601()
  to?: string;
}

// ─── Recommendation Result ────────────────────────────────────────────────────

export class RecommendationReasonDto {
  @ApiProperty({ example: 'PREFERRED_CATEGORY' })
  code!: string;

  @ApiProperty({ example: 'Matches your preferred category' })
  label!: string;

  @ApiPropertyOptional({ example: 'You have marked restaurant as a preferred category.' })
  detail?: string;
}

export class RecommendationResultDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  catalogItemId!: string;

  @ApiProperty({ enum: RecommendationCategory })
  category!: RecommendationCategory;

  @ApiProperty({ example: 'Executive Garden Bistro (Demo)' })
  title!: string;

  @ApiProperty({ example: 'Refined cuisine in a serene garden setting.' })
  summary!: string;

  @ApiPropertyOptional({ example: 'Jardins' })
  neighborhood!: string | null;

  @ApiProperty({ example: 75 })
  estimatedDurationMinutes!: number;

  @ApiProperty({ type: [String], example: ['LUNCH', 'DINNER'] })
  suitableWindows!: string[];

  @ApiProperty({ example: 87 })
  relevanceScore!: number;

  @ApiProperty({ type: [RecommendationReasonDto] })
  reasons!: RecommendationReasonDto[];

  @ApiProperty({ type: [String] })
  cautionNotes!: string[];

  @ApiProperty({ example: 'SEED' })
  sourceType!: string;

  @ApiProperty({ example: 4 })
  priceLevel!: number;

  @ApiProperty({ example: 5 })
  premiumScore!: number;

  @ApiProperty({ type: [String] })
  tags!: string[];

  @ApiPropertyOptional({ example: 'https://example.com/image.jpg' })
  imageUrl!: string | null;

  @ApiPropertyOptional({ example: 'https://example.com' })
  websiteUrl!: string | null;
}

export class RecommendationResponseDto {
  @ApiProperty()
  sessionId!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  requestedAt!: Date;

  @ApiProperty()
  windowStart!: Date;

  @ApiProperty()
  windowEnd!: Date;

  @ApiProperty({ example: 'moderate', enum: ['low', 'moderate', 'high'] })
  scheduleDensity!: string;

  @ApiProperty({ type: [RecommendationResultDto] })
  recommendations!: RecommendationResultDto[];
}

// ─── Feedback ─────────────────────────────────────────────────────────────────

export class RecommendationFeedbackDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsString()
  sessionId!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsString()
  catalogItemId!: string;

  @ApiProperty({
    example: 'HELPFUL',
    enum: ['HELPFUL', 'NOT_HELPFUL', 'SAVED', 'DISMISSED', 'ACTED_ON'],
  })
  @IsString()
  action!: string;

  @ApiPropertyOptional({ example: 'Not enough time today' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class RecommendationFeedbackResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  sessionId!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  catalogItemId!: string;

  @ApiProperty()
  action!: string;

  @ApiPropertyOptional()
  reason?: string | null;

  @ApiProperty()
  createdAt!: Date;
}

// ─── Session Summary ──────────────────────────────────────────────────────────

export class RecommendationSessionSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  windowStart!: Date;

  @ApiProperty()
  windowEnd!: Date;

  @ApiProperty()
  requestedAt!: Date;

  @ApiProperty({ description: 'Snapshot of the schedule context used for this session' })
  contextSnapshot!: Record<string, unknown>;

  @ApiProperty({ description: 'Snapshot of results returned in this session' })
  resultsSnapshot!: unknown[];
}
