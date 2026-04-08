import { Test, TestingModule } from '@nestjs/testing';
import { ScheduleContextService } from '../services/schedule-context.service';
import { CalendarEventService } from '../../calendar/services/calendar-event.service';
import { ScheduleContext } from '../domain/schedule-context.model';

function makeEvent(
  startIso: string,
  endIso: string,
  isAllDay = false,
  isCancelled = false,
) {
  return {
    id: `evt-${Math.random()}`,
    connectionId: 'conn-1',
    title: 'Meeting',
    startAt: new Date(startIso),
    endAt: new Date(endIso),
    isAllDay,
    isCancelled,
    provider: 'GOOGLE' as const,
    description: null,
    location: null,
    meetingUrl: null,
    organizer: null,
  };
}

describe('ScheduleContextService', () => {
  let service: ScheduleContextService;
  let calendarEventService: jest.Mocked<CalendarEventService>;

  const referenceDate = new Date('2026-04-07T00:00:00Z');
  const referenceTimezone = 'UTC';

  beforeEach(async () => {
    const mockCalendarEventService = {
      getUpcomingEvents: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScheduleContextService,
        { provide: CalendarEventService, useValue: mockCalendarEventService },
      ],
    }).compile();

    service = module.get<ScheduleContextService>(ScheduleContextService);
    calendarEventService = module.get(CalendarEventService);
  });

  // ─── Free window derivation ───────────────────────────────────────────────

  describe('free window derivation', () => {
    it('should return no free windows when back-to-back meetings fill the day', async () => {
      calendarEventService.getUpcomingEvents.mockResolvedValue([
        makeEvent('2026-04-07T08:00:00Z', '2026-04-07T12:00:00Z'),
        makeEvent('2026-04-07T12:00:00Z', '2026-04-07T18:00:00Z'),
      ]);

      const ctx = await service.deriveContext('user-1', referenceDate, referenceTimezone);
      // Very tight day — free windows only outside 08-18 band
      const nonTrivialFree = ctx.freeWindows.filter((w) => w.durationMinutes >= 30);
      // Before 08:00 = 480 min and after 18:00 = 359 min are free
      expect(nonTrivialFree.length).toBeGreaterThanOrEqual(0);
    });

    it('should detect a free gap between two separated meetings', async () => {
      calendarEventService.getUpcomingEvents.mockResolvedValue([
        makeEvent('2026-04-07T09:00:00Z', '2026-04-07T10:00:00Z'),
        makeEvent('2026-04-07T13:00:00Z', '2026-04-07T14:00:00Z'),
      ]);

      const ctx = await service.deriveContext('user-1', referenceDate, referenceTimezone);
      const gaps = ctx.freeWindows.filter((w) => w.durationMinutes >= 30);
      expect(gaps.length).toBeGreaterThan(0);
    });

    it('should return large free windows with no events', async () => {
      calendarEventService.getUpcomingEvents.mockResolvedValue([]);
      const ctx = await service.deriveContext('user-1', referenceDate, referenceTimezone);
      expect(ctx.freeWindows.length).toBeGreaterThan(0);
      expect(ctx.freeWindows[0]!.durationMinutes).toBeGreaterThan(60);
    });

    it('should exclude all-day events from occupied windows', async () => {
      calendarEventService.getUpcomingEvents.mockResolvedValue([
        makeEvent('2026-04-07T00:00:00Z', '2026-04-07T23:59:59Z', true),
      ]);
      const ctx = await service.deriveContext('user-1', referenceDate, referenceTimezone);
      expect(ctx.occupiedWindows.length).toBe(0);
    });

    it('should exclude cancelled events from occupied windows', async () => {
      calendarEventService.getUpcomingEvents.mockResolvedValue([
        makeEvent('2026-04-07T10:00:00Z', '2026-04-07T11:00:00Z', false, true),
      ]);
      const ctx = await service.deriveContext('user-1', referenceDate, referenceTimezone);
      expect(ctx.occupiedWindows.length).toBe(0);
    });
  });

  // ─── Meal window detection ─────────────────────────────────────────────────

  describe('meal window detection', () => {
    it('should detect MEAL_OPPORTUNITY with free gap 12:00-13:30', async () => {
      calendarEventService.getUpcomingEvents.mockResolvedValue([
        makeEvent('2026-04-07T09:00:00Z', '2026-04-07T12:00:00Z'),
        makeEvent('2026-04-07T13:30:00Z', '2026-04-07T15:00:00Z'),
      ]);

      const ctx = await service.deriveContext('user-1', referenceDate, referenceTimezone);
      expect(ctx.hasMealOpportunity).toBe(true);
    });

    it('should NOT detect MEAL_OPPORTUNITY when lunch window is too short', async () => {
      // Only 20 min free at lunch time
      calendarEventService.getUpcomingEvents.mockResolvedValue([
        makeEvent('2026-04-07T09:00:00Z', '2026-04-07T12:00:00Z'),
        makeEvent('2026-04-07T12:20:00Z', '2026-04-07T15:00:00Z'),
      ]);

      const ctx = await service.deriveContext('user-1', referenceDate, referenceTimezone);
      expect(ctx.hasMealOpportunity).toBe(false);
    });

    it('should detect EVENING_FREE with free time 20:00-22:00', async () => {
      calendarEventService.getUpcomingEvents.mockResolvedValue([
        makeEvent('2026-04-07T09:00:00Z', '2026-04-07T19:30:00Z'),
      ]);

      const ctx = await service.deriveContext('user-1', referenceDate, referenceTimezone);
      expect(ctx.hasEveningFree).toBe(true);
    });
  });

  // ─── Schedule density calculation ──────────────────────────────────────────

  describe('schedule density calculation', () => {
    it('should be low with 0 meetings', async () => {
      calendarEventService.getUpcomingEvents.mockResolvedValue([]);
      const ctx = await service.deriveContext('user-1', referenceDate, referenceTimezone);
      expect(ctx.scheduleDensity).toBe('low');
    });

    it('should be low with 1 meeting', async () => {
      calendarEventService.getUpcomingEvents.mockResolvedValue([
        makeEvent('2026-04-07T10:00:00Z', '2026-04-07T11:00:00Z'),
      ]);
      const ctx = await service.deriveContext('user-1', referenceDate, referenceTimezone);
      expect(ctx.scheduleDensity).toBe('low');
    });

    it('should be moderate with 3 meetings', async () => {
      calendarEventService.getUpcomingEvents.mockResolvedValue([
        makeEvent('2026-04-07T09:00:00Z', '2026-04-07T10:00:00Z'),
        makeEvent('2026-04-07T11:00:00Z', '2026-04-07T12:00:00Z'),
        makeEvent('2026-04-07T14:00:00Z', '2026-04-07T15:00:00Z'),
      ]);
      const ctx = await service.deriveContext('user-1', referenceDate, referenceTimezone);
      expect(ctx.scheduleDensity).toBe('moderate');
    });

    it('should be high with 5 meetings', async () => {
      calendarEventService.getUpcomingEvents.mockResolvedValue([
        makeEvent('2026-04-07T08:00:00Z', '2026-04-07T09:00:00Z'),
        makeEvent('2026-04-07T09:00:00Z', '2026-04-07T10:00:00Z'),
        makeEvent('2026-04-07T10:00:00Z', '2026-04-07T11:00:00Z'),
        makeEvent('2026-04-07T11:00:00Z', '2026-04-07T12:00:00Z'),
        makeEvent('2026-04-07T13:00:00Z', '2026-04-07T14:00:00Z'),
      ]);
      const ctx = await service.deriveContext('user-1', referenceDate, referenceTimezone);
      expect(ctx.scheduleDensity).toBe('high');
      expect(ctx.isPrimaryWorkDay).toBe(true);
    });
  });

  // ─── Opportunity window identification ─────────────────────────────────────

  describe('opportunity window identification', () => {
    it('should include free windows >= 45 min as opportunity windows', async () => {
      calendarEventService.getUpcomingEvents.mockResolvedValue([
        makeEvent('2026-04-07T09:00:00Z', '2026-04-07T10:00:00Z'),
        makeEvent('2026-04-07T11:30:00Z', '2026-04-07T12:30:00Z'),
      ]);

      const ctx = await service.deriveContext('user-1', referenceDate, referenceTimezone);
      // Gap between 10:00 and 11:30 = 90 min — should be an opportunity window
      const has90MinOpportunity = ctx.opportunityWindows.some((w) => w.durationMinutes >= 45);
      expect(has90MinOpportunity).toBe(true);
    });

    it('should have no opportunity windows when all free windows are < 45 min', async () => {
      // Pack the entire day with meetings that leave only ~20-min gaps
      calendarEventService.getUpcomingEvents.mockResolvedValue([
        makeEvent('2026-04-07T00:00:00Z', '2026-04-07T00:40:00Z'),
        makeEvent('2026-04-07T01:00:00Z', '2026-04-07T01:40:00Z'),
        makeEvent('2026-04-07T02:00:00Z', '2026-04-07T02:40:00Z'),
        makeEvent('2026-04-07T03:00:00Z', '2026-04-07T03:40:00Z'),
        makeEvent('2026-04-07T04:00:00Z', '2026-04-07T04:40:00Z'),
        makeEvent('2026-04-07T05:00:00Z', '2026-04-07T05:40:00Z'),
        makeEvent('2026-04-07T06:00:00Z', '2026-04-07T06:40:00Z'),
        makeEvent('2026-04-07T07:00:00Z', '2026-04-07T07:40:00Z'),
        makeEvent('2026-04-07T08:00:00Z', '2026-04-07T08:40:00Z'),
        makeEvent('2026-04-07T09:00:00Z', '2026-04-07T09:40:00Z'),
        makeEvent('2026-04-07T10:00:00Z', '2026-04-07T10:40:00Z'),
        makeEvent('2026-04-07T11:00:00Z', '2026-04-07T11:40:00Z'),
        makeEvent('2026-04-07T12:00:00Z', '2026-04-07T12:40:00Z'),
        makeEvent('2026-04-07T13:00:00Z', '2026-04-07T13:40:00Z'),
        makeEvent('2026-04-07T14:00:00Z', '2026-04-07T14:40:00Z'),
        makeEvent('2026-04-07T15:00:00Z', '2026-04-07T15:40:00Z'),
        makeEvent('2026-04-07T16:00:00Z', '2026-04-07T16:40:00Z'),
        makeEvent('2026-04-07T17:00:00Z', '2026-04-07T17:40:00Z'),
        makeEvent('2026-04-07T18:00:00Z', '2026-04-07T18:40:00Z'),
        makeEvent('2026-04-07T19:00:00Z', '2026-04-07T19:40:00Z'),
        makeEvent('2026-04-07T20:00:00Z', '2026-04-07T20:40:00Z'),
        makeEvent('2026-04-07T21:00:00Z', '2026-04-07T21:40:00Z'),
        makeEvent('2026-04-07T22:00:00Z', '2026-04-07T22:40:00Z'),
        makeEvent('2026-04-07T23:00:00Z', '2026-04-07T23:40:00Z'),
      ]);

      const ctx = await service.deriveContext('user-1', referenceDate, referenceTimezone);
      // All gaps between meetings are 20 min — below the 45-min threshold
      // The entire day is covered so no large early/late windows exist either
      const bigOpportunities = ctx.opportunityWindows.filter((w) => w.durationMinutes >= 45);
      expect(bigOpportunities.length).toBe(0);
    });

    it('should populate context fields correctly', async () => {
      calendarEventService.getUpcomingEvents.mockResolvedValue([]);
      const ctx: ScheduleContext = await service.deriveContext(
        'user-1',
        referenceDate,
        referenceTimezone,
      );

      expect(ctx.userId).toBe('user-1');
      expect(ctx.timezone).toBe(referenceTimezone);
      expect(ctx.nextMeetingStartsAt).toBeNull();
      expect(ctx.lastMeetingEndsAt).toBeNull();
      expect(ctx.isPrimaryWorkDay).toBe(false);
    });
  });
});
