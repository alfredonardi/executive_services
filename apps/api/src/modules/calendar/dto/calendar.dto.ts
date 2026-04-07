import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CalendarProvider } from '@prisma/client';
import { IsEnum, IsISO8601, IsOptional, IsPositive, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class GetEventsQueryDto {
  @ApiPropertyOptional({ description: 'Start of time window (ISO 8601)', example: '2026-04-01T00:00:00Z' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'End of time window (ISO 8601)', example: '2026-04-30T23:59:59Z' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ description: 'Max events to return', default: 50, maximum: 200 })
  @IsOptional()
  @IsPositive()
  @Max(200)
  @Type(() => Number)
  limit?: number;
}

export class CalendarConnectionResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ enum: CalendarProvider, example: 'GOOGLE' })
  provider!: string;

  @ApiPropertyOptional({ example: 'john.doe@gmail.com' })
  email?: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiPropertyOptional({ example: '2026-04-07T10:00:00Z' })
  syncedAt?: Date | null;

  @ApiProperty({ example: '2026-04-01T00:00:00Z' })
  createdAt!: Date;
}

export class CalendarEventResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: 'Board Meeting - Q2 Review' })
  title!: string;

  @ApiPropertyOptional({ example: 'Quarterly review with the executive team' })
  description?: string | null;

  @ApiProperty({ example: '2026-04-07T14:00:00Z' })
  startAt!: Date;

  @ApiProperty({ example: '2026-04-07T15:30:00Z' })
  endAt!: Date;

  @ApiProperty({ example: false })
  isAllDay!: boolean;

  @ApiPropertyOptional({ example: 'Paulista Avenue 1000, São Paulo' })
  location?: string | null;

  @ApiPropertyOptional({ example: 'https://meet.google.com/abc-defg-hij' })
  meetingUrl?: string | null;

  @ApiPropertyOptional({ example: 'organizer@company.com' })
  organizer?: string | null;

  @ApiProperty({ example: false })
  isCancelled!: boolean;

  @ApiProperty({ enum: CalendarProvider, example: 'GOOGLE' })
  provider!: string;
}

export class TriggerSyncResponseDto {
  @ApiProperty({ example: 'Sync started for connection 550e8400-e29b-41d4-a716-446655440000' })
  message!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  syncAttemptId!: string;
}

export class ConnectCalendarResponseDto {
  @ApiProperty({ example: 'https://accounts.google.com/o/oauth2/v2/auth?...' })
  authorizationUrl!: string;

  @ApiProperty({ description: 'Opaque state token. The mobile app must include this in the callback URL to prevent CSRF.' })
  state!: string;
}

export class SyncStatusResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  connectionId!: string;

  @ApiProperty({ enum: CalendarProvider })
  provider!: string;

  @ApiPropertyOptional({ example: '2026-04-07T10:00:00Z' })
  lastSyncedAt?: Date | null;

  @ApiPropertyOptional({ description: 'Most recent sync attempt' })
  lastAttempt?: {
    status: string;
    eventsAdded: number;
    eventsUpdated: number;
    eventsRemoved: number;
    errorMessage?: string | null;
    createdAt: Date;
  } | null;
}

export class FilterEventsQueryDto extends GetEventsQueryDto {
  @ApiPropertyOptional({ enum: CalendarProvider, description: 'Filter by provider' })
  @IsOptional()
  @IsEnum(CalendarProvider)
  provider?: CalendarProvider;
}
