import { Injectable, Logger } from '@nestjs/common';
import { CalendarEventService } from '../../calendar/services/calendar-event.service';
import { ScheduleContext, TimeWindow, WindowType } from '../domain/schedule-context.model';

interface RawEvent {
  id: string;
  startAt: Date;
  endAt: Date;
  isAllDay: boolean;
  isCancelled: boolean;
}

interface DeriveContextOptions {
  dayStart?: Date;
  dayEnd?: Date;
  now?: Date;
}

@Injectable()
export class ScheduleContextService {
  private readonly logger = new Logger(ScheduleContextService.name);

  constructor(private readonly calendarEventService: CalendarEventService) {}

  async deriveContext(
    userId: string,
    referenceDate: Date,
    timezone: string = 'America/Sao_Paulo',
    options: DeriveContextOptions = {},
  ): Promise<ScheduleContext> {
    const fallbackBounds = this.getDayBounds(referenceDate, timezone);
    const dayStart = options.dayStart ?? fallbackBounds.dayStart;
    const dayEnd = options.dayEnd ?? fallbackBounds.dayEnd;

    const rawEvents = await this.calendarEventService.getUpcomingEvents({
      userId,
      from: dayStart,
      to: dayEnd,
    });

    const relevantEvents: RawEvent[] = rawEvents
      .filter((e) => !e.isAllDay && !e.isCancelled)
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

    this.logger.debug(
      `Deriving schedule context for user ${userId} — ${relevantEvents.length} events on ${referenceDate.toISOString().split('T')[0]}`,
    );

    const occupiedWindows = this.buildOccupiedWindows(relevantEvents);
    const freeWindows = this.buildFreeWindows(occupiedWindows, dayStart, dayEnd, timezone);
    const opportunityWindows = this.identifyOpportunityWindows(freeWindows, occupiedWindows);

    const meetingCount = relevantEvents.length;
    const scheduleDensity: 'low' | 'moderate' | 'high' =
      meetingCount < 2 ? 'low' : meetingCount <= 4 ? 'moderate' : 'high';

    const hasMealOpportunity = freeWindows.some((w) => w.type === 'MEAL_OPPORTUNITY');
    const hasEveningFree = freeWindows.some((w) => w.type === 'EVENING_FREE');

    const now = options.now ?? new Date();
    const nextMeeting = relevantEvents.find((e) => e.startAt > now);
    const lastMeeting =
      relevantEvents.length > 0 ? relevantEvents[relevantEvents.length - 1] : null;

    return {
      userId,
      referenceDate,
      timezone,
      occupiedWindows,
      freeWindows,
      opportunityWindows,
      scheduleDensity,
      isPrimaryWorkDay: scheduleDensity === 'moderate' || scheduleDensity === 'high',
      hasMealOpportunity,
      hasEveningFree,
      nextMeetingStartsAt: nextMeeting?.startAt ?? null,
      lastMeetingEndsAt: lastMeeting?.endAt ?? null,
    };
  }

  private buildOccupiedWindows(events: RawEvent[]): TimeWindow[] {
    return events.map((e) => {
      const durationMinutes = Math.round(
        (e.endAt.getTime() - e.startAt.getTime()) / 60_000,
      );
      return {
        start: e.startAt,
        end: e.endAt,
        durationMinutes,
        type: 'OCCUPIED' as WindowType,
        label: `${durationMinutes}-min meeting`,
      };
    });
  }

  private buildFreeWindows(
    occupiedWindows: TimeWindow[],
    dayStart: Date,
    dayEnd: Date,
    timezone: string,
  ): TimeWindow[] {
    const freeWindows: TimeWindow[] = [];

    // Merge overlapping occupied windows first
    const merged = this.mergeOverlapping(occupiedWindows);

    // Boundary construction guarantees an even-length array:
    //   [dayStart,  m1.start, m1.end,  m2.start, m2.end,  dayEnd]
    // Because we add exactly 1 dayStart + 2 per merged meeting + 1 dayEnd = 2n+2 (always even).
    // Consecutive pairs (i, i+1) for i=0,2,4,… are the FREE gaps between (or around) meetings.
    const boundaries: Date[] = [dayStart, ...merged.flatMap((w) => [w.start, w.end]), dayEnd];

    // Safety assertion: length must be even (1 dayStart + 2×meetings + 1 dayEnd).
    if (boundaries.length % 2 !== 0) {
      this.logger.warn('Unexpected odd boundary count — skipping free-window derivation');
      return freeWindows;
    }

    for (let i = 0; i < boundaries.length - 1; i += 2) {
      const start: Date | undefined = boundaries[i];
      const end: Date | undefined = boundaries[i + 1];

      if (!start || !end) continue;

      // Skip zero-length or negative gaps
      if (end.getTime() <= start.getTime()) continue;

      const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60_000);
      if (durationMinutes < 5) continue; // ignore very tiny gaps

      const type = this.classifyFreeWindow(start, end, durationMinutes, timezone);
      freeWindows.push({
        start,
        end,
        durationMinutes,
        type,
        label: this.buildFreeWindowLabel(durationMinutes, type),
      });
    }

    // Mark PRE_MEETING / POST_MEETING windows based on proximity to occupied windows
    this.annotatePeriMeetingWindows(freeWindows, merged);

    return freeWindows;
  }

  private mergeOverlapping(windows: TimeWindow[]): TimeWindow[] {
    if (windows.length === 0) return [];
    const sorted = [...windows].sort((a, b) => a.start.getTime() - b.start.getTime());
    const first = sorted[0];
    if (!first) return [];
    const merged: TimeWindow[] = [{ ...first }];

    for (let i = 1; i < sorted.length; i++) {
      const last = merged[merged.length - 1] as TimeWindow;
      const current = sorted[i] as TimeWindow;
      if (current.start <= last.end) {
        last.end = new Date(Math.max(last.end.getTime(), current.end.getTime()));
        last.durationMinutes = Math.round(
          (last.end.getTime() - last.start.getTime()) / 60_000,
        );
      } else {
        merged.push({ ...current });
      }
    }
    return merged;
  }

  private classifyFreeWindow(
    start: Date,
    end: Date,
    durationMinutes: number,
    timezone: string,
  ): WindowType {
    const startHour = this.getHourInTimezone(start, timezone);
    const endHour = this.getHourInTimezone(end, timezone);

    // Morning start: before 09:00 with >= 30 min
    if (startHour < 9 && durationMinutes >= 30) {
      return 'MORNING_START';
    }

    // Meal opportunity: 11:30-14:30 with >= 45 min
    if (startHour >= 11.5 && endHour <= 14.5 && durationMinutes >= 45) {
      return 'MEAL_OPPORTUNITY';
    }

    // Evening free: starts in 19:00-22:00 range with >= 60 min
    if (startHour >= 19 && startHour < 22 && durationMinutes >= 60) {
      return 'EVENING_FREE';
    }

    return 'FREE';
  }

  private buildFreeWindowLabel(durationMinutes: number, type: WindowType): string {
    const durationLabel = `${durationMinutes}-min`;
    switch (type) {
      case 'MORNING_START':
        return `${durationLabel} morning slot`;
      case 'MEAL_OPPORTUNITY':
        return `${durationLabel} lunch window`;
      case 'EVENING_FREE':
        return `${durationLabel} evening window`;
      default:
        return `${durationLabel} gap between meetings`;
    }
  }

  private annotatePeriMeetingWindows(freeWindows: TimeWindow[], occupied: TimeWindow[]): void {
    for (const free of freeWindows) {
      if (free.type !== 'FREE') continue;

      const isPreMeeting = occupied.some(
        (o) =>
          o.start.getTime() - free.end.getTime() >= 0 &&
          o.start.getTime() - free.end.getTime() < 30 * 60_000,
      );
      const isPostMeeting = occupied.some(
        (o) =>
          free.start.getTime() - o.end.getTime() >= 0 &&
          free.start.getTime() - o.end.getTime() < 30 * 60_000,
      );

      if (isPreMeeting) {
        free.type = 'PRE_MEETING';
        free.label = `${free.durationMinutes}-min slot before meeting`;
      } else if (isPostMeeting) {
        free.type = 'POST_MEETING';
        free.label = `${free.durationMinutes}-min slot after meeting`;
      }
    }
  }

  private identifyOpportunityWindows(
    freeWindows: TimeWindow[],
    occupiedWindows: TimeWindow[],
  ): TimeWindow[] {
    const opportunities = freeWindows.filter((w) => w.durationMinutes >= 45);

    // Also add POST_MEETING windows even if < 45 min (useful for quick recommendations)
    const postMeeting = freeWindows.filter(
      (w) => w.type === 'POST_MEETING' && w.durationMinutes >= 20,
    );

    const combined = [...new Set([...opportunities, ...postMeeting])];
    return combined;
  }

  private getHourInTimezone(date: Date, timezone: string): number {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const partMap = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return Number(partMap['hour']) + Number(partMap['minute']) / 60;
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

    return {
      dayStart: this.zonedDateTimeToUtc(year, month, day, 0, 0, 0, 0, timezone),
      dayEnd: this.zonedDateTimeToUtc(year, month, day, 23, 59, 59, 999, timezone),
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
