import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CalendarProvider } from '@prisma/client';

export class TodayCalendarConnectionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: CalendarProvider })
  provider!: CalendarProvider;

  @ApiPropertyOptional()
  email?: string | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiPropertyOptional()
  syncedAt?: Date | null;

  @ApiProperty()
  createdAt!: Date;
}

export class TodaySyncAttemptDto {
  @ApiProperty()
  status!: string;

  @ApiProperty()
  eventsAdded!: number;

  @ApiProperty()
  eventsUpdated!: number;

  @ApiProperty()
  eventsRemoved!: number;

  @ApiPropertyOptional()
  errorMessage?: string | null;

  @ApiProperty()
  createdAt!: Date;
}

export class TodaySyncStatusDto {
  @ApiProperty()
  connectionId!: string;

  @ApiProperty({ enum: CalendarProvider })
  provider!: CalendarProvider;

  @ApiPropertyOptional()
  lastSyncedAt?: Date | null;

  @ApiPropertyOptional({ type: TodaySyncAttemptDto })
  lastAttempt?: TodaySyncAttemptDto | null;
}

export class TodayEventDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  startAt!: Date;

  @ApiProperty()
  endAt!: Date;

  @ApiProperty()
  provider!: CalendarProvider | null;

  @ApiPropertyOptional()
  location?: string | null;

  @ApiPropertyOptional()
  meetingUrl?: string | null;

  @ApiProperty()
  isAllDay!: boolean;

  @ApiProperty({ enum: ['upcoming', 'in_progress', 'completed'] })
  status!: 'upcoming' | 'in_progress' | 'completed';
}

export class TodayWindowDto {
  @ApiProperty()
  startAt!: Date;

  @ApiProperty()
  endAt!: Date;

  @ApiProperty()
  durationMinutes!: number;

  @ApiProperty()
  type!: string;

  @ApiProperty()
  label!: string;
}

export class TodaySummaryDto {
  @ApiProperty()
  meetingCount!: number;

  @ApiProperty()
  freeWindowCount!: number;

  @ApiProperty()
  opportunityWindowCount!: number;

  @ApiProperty()
  hasMealOpportunity!: boolean;

  @ApiProperty()
  hasEveningFree!: boolean;

  @ApiPropertyOptional()
  nextMeetingStartsAt?: Date | null;

  @ApiPropertyOptional()
  lastMeetingEndsAt?: Date | null;
}

export class TodayResponseDto {
  @ApiProperty({ example: '2026-04-08' })
  date!: string;

  @ApiProperty({ example: 'America/Sao_Paulo' })
  timezone!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty({ example: true })
  hasCalendarConnection!: boolean;

  @ApiProperty({ example: false })
  needsInitialSync!: boolean;

  @ApiProperty({ example: 'moderate', enum: ['low', 'moderate', 'high'] })
  scheduleDensity!: 'low' | 'moderate' | 'high';

  @ApiProperty({ type: TodaySummaryDto })
  summary!: TodaySummaryDto;

  @ApiProperty({ type: [TodayCalendarConnectionDto] })
  connections!: TodayCalendarConnectionDto[];

  @ApiProperty({ type: [TodaySyncStatusDto] })
  syncStatus!: TodaySyncStatusDto[];

  @ApiProperty({ type: [TodayEventDto] })
  events!: TodayEventDto[];

  @ApiProperty({ type: [TodayWindowDto] })
  freeWindows!: TodayWindowDto[];

  @ApiProperty({ type: [TodayWindowDto] })
  opportunityWindows!: TodayWindowDto[];
}
