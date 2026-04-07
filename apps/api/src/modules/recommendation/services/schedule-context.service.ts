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

@Injectable()
export class ScheduleContextService {
  private readonly logger = new Logger(ScheduleContextService.name);

  constructor(private readonly calendarEventService: CalendarEventService) {}

  async deriveContext(
    userId: string,
    referenceDate: Date,
    timezone: string = 'America/Sao_Paulo',
  ): Promise<ScheduleContext> {
    // Define the day window: midnight to 23:59:59 in the target day
    const dayStart = new Date(referenceDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(referenceDate);
    dayEnd.setHours(23, 59, 59, 999);

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
    const freeWindows = this.buildFreeWindows(occupiedWindows, dayStart, dayEnd);
    const opportunityWindows = this.identifyOpportunityWindows(freeWindows, occupiedWindows);

    const meetingCount = relevantEvents.length;
    const scheduleDensity: 'low' | 'moderate' | 'high' =
      meetingCount < 2 ? 'low' : meetingCount <= 4 ? 'moderate' : 'high';

    const hasMealOpportunity = freeWindows.some((w) => w.type === 'MEAL_OPPORTUNITY');
    const hasEveningFree = freeWindows.some((w) => w.type === 'EVENING_FREE');

    const now = new Date();
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
  ): TimeWindow[] {
    const freeWindows: TimeWindow[] = [];

    // Merge overlapping occupied windows first
    const merged = this.mergeOverlapping(occupiedWindows);

    const boundaries: Date[] = [dayStart, ...merged.flatMap((w) => [w.start, w.end]), dayEnd];

    for (let i = 0; i < boundaries.length - 1; i += 2) {
      const start: Date | undefined = boundaries[i];
      const end: Date | undefined = boundaries[i + 1];

      if (!start || !end) continue;

      // Skip zero-length or negative gaps
      if (end.getTime() <= start.getTime()) continue;

      const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60_000);
      if (durationMinutes < 5) continue; // ignore very tiny gaps

      const type = this.classifyFreeWindow(start, end, durationMinutes);
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

  private classifyFreeWindow(start: Date, end: Date, durationMinutes: number): WindowType {
    const startHour = start.getHours() + start.getMinutes() / 60;
    const endHour = end.getHours() + end.getMinutes() / 60;

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
}
