import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CalendarConnectionService } from '../calendar/services/calendar-connection.service';
import { CalendarEventService } from '../calendar/services/calendar-event.service';
import { ScheduleContextService } from '../recommendation/services/schedule-context.service';
import { TodayResponseDto, TodayWindowDto } from './dto/today.dto';

@Injectable()
export class TodayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly connectionService: CalendarConnectionService,
    private readonly eventService: CalendarEventService,
    private readonly scheduleContextService: ScheduleContextService,
  ) {}

  async getTodayOverview(userId: string): Promise<TodayResponseDto> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { firstName: true, timezone: true },
    });

    const timezone = user.timezone || 'America/Sao_Paulo';
    const now = new Date();
    const { dayStart, dayEnd, localDate } = this.getDayBounds(now, timezone);

    const [connections, syncStatus, events, schedule] = await Promise.all([
      this.connectionService.listConnections(userId),
      this.eventService.getSyncStatus(userId),
      this.eventService.getUpcomingEvents({
        userId,
        from: dayStart,
        to: dayEnd,
        limit: 100,
      }),
      this.scheduleContextService.deriveContext(userId, now, timezone, {
        dayStart,
        dayEnd,
        now,
      }),
    ]);

    return {
      date: localDate,
      timezone,
      firstName: user.firstName,
      hasCalendarConnection: connections.length > 0,
      needsInitialSync: connections.length > 0 && connections.every((connection) => !connection.syncedAt),
      scheduleDensity: schedule.scheduleDensity,
      summary: {
        meetingCount: events.length,
        freeWindowCount: schedule.freeWindows.length,
        opportunityWindowCount: schedule.opportunityWindows.length,
        hasMealOpportunity: schedule.hasMealOpportunity,
        hasEveningFree: schedule.hasEveningFree,
        nextMeetingStartsAt: schedule.nextMeetingStartsAt,
        lastMeetingEndsAt: schedule.lastMeetingEndsAt,
      },
      connections,
      syncStatus,
      events: events.map((event) => ({
        id: event.id,
        title: event.title,
        startAt: event.startAt,
        endAt: event.endAt,
        provider: event.provider,
        location: event.location,
        meetingUrl: event.meetingUrl,
        isAllDay: event.isAllDay,
        status: this.getEventStatus(event.startAt, event.endAt, now),
      })),
      freeWindows: this.mapWindows(schedule.freeWindows),
      opportunityWindows: this.mapWindows(schedule.opportunityWindows),
    };
  }

  private mapWindows(
    windows: Array<{ start: Date; end: Date; durationMinutes: number; type: string; label: string }>,
  ): TodayWindowDto[] {
    return windows.map((window) => ({
      startAt: window.start,
      endAt: window.end,
      durationMinutes: window.durationMinutes,
      type: window.type,
      label: window.label,
    }));
  }

  private getEventStatus(
    startAt: Date,
    endAt: Date,
    now: Date,
  ): 'upcoming' | 'in_progress' | 'completed' {
    if (startAt <= now && endAt >= now) {
      return 'in_progress';
    }
    if (endAt < now) {
      return 'completed';
    }
    return 'upcoming';
  }

  private getDayBounds(referenceDate: Date, timezone: string) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(referenceDate);
    const partMap = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const year = Number(partMap['year']);
    const month = Number(partMap['month']);
    const day = Number(partMap['day']);
    const dayStart = this.zonedDateTimeToUtc(year, month, day, 0, 0, 0, 0, timezone);
    const dayEnd = this.zonedDateTimeToUtc(year, month, day, 23, 59, 59, 999, timezone);

    return {
      dayStart,
      dayEnd,
      localDate: `${year.toString().padStart(4, '0')}-${month
        .toString()
        .padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
    };
  }

  private zonedDateTimeToUtc(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second: number,
    millisecond: number,
    timezone: string,
  ): Date {
    const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond));
    const offset = this.getTimeZoneOffsetMs(utcGuess, timezone);
    return new Date(utcGuess.getTime() - offset);
  }

  private getTimeZoneOffsetMs(date: Date, timezone: string): number {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(date);

    const partMap = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const asUtc = Date.UTC(
      Number(partMap['year']),
      Number(partMap['month']) - 1,
      Number(partMap['day']),
      Number(partMap['hour']),
      Number(partMap['minute']),
      Number(partMap['second']),
      date.getUTCMilliseconds(),
    );

    return asUtc - date.getTime();
  }
}
