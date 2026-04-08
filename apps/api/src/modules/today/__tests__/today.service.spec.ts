import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../prisma/prisma.service';
import { CalendarConnectionService } from '../../calendar/services/calendar-connection.service';
import { CalendarEventService } from '../../calendar/services/calendar-event.service';
import { ScheduleContextService } from '../../recommendation/services/schedule-context.service';
import { TodayService } from '../today.service';

describe('TodayService', () => {
  let service: TodayService;
  let prisma: jest.Mocked<PrismaService>;
  let connectionService: jest.Mocked<CalendarConnectionService>;
  let eventService: jest.Mocked<CalendarEventService>;
  let scheduleContextService: jest.Mocked<ScheduleContextService>;

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-08T12:00:00.000Z'));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TodayService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUniqueOrThrow: jest.fn(),
            },
          },
        },
        {
          provide: CalendarConnectionService,
          useValue: {
            listConnections: jest.fn(),
          },
        },
        {
          provide: CalendarEventService,
          useValue: {
            getSyncStatus: jest.fn(),
            getUpcomingEvents: jest.fn(),
          },
        },
        {
          provide: ScheduleContextService,
          useValue: {
            deriveContext: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(TodayService);
    prisma = module.get(PrismaService);
    connectionService = module.get(CalendarConnectionService);
    eventService = module.get(CalendarEventService);
    scheduleContextService = module.get(ScheduleContextService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns a graceful no-calendar response', async () => {
    (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue({
      firstName: 'Ana',
      timezone: 'UTC',
    });
    connectionService.listConnections.mockResolvedValue([]);
    eventService.getSyncStatus.mockResolvedValue([]);
    eventService.getUpcomingEvents.mockResolvedValue([]);
    scheduleContextService.deriveContext.mockResolvedValue({
      userId: 'user-1',
      referenceDate: new Date('2026-04-08T12:00:00.000Z'),
      timezone: 'UTC',
      occupiedWindows: [],
      freeWindows: [],
      opportunityWindows: [],
      scheduleDensity: 'low',
      isPrimaryWorkDay: false,
      hasMealOpportunity: false,
      hasEveningFree: false,
      nextMeetingStartsAt: null,
      lastMeetingEndsAt: null,
    });

    const result = await service.getTodayOverview('user-1');

    expect(result.date).toBe('2026-04-08');
    expect(result.firstName).toBe('Ana');
    expect(result.hasCalendarConnection).toBe(false);
    expect(result.needsInitialSync).toBe(false);
    expect(result.events).toEqual([]);
    expect(result.freeWindows).toEqual([]);
  });

  it('maps live events, statuses, and initial sync state', async () => {
    (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue({
      firstName: 'Ana',
      timezone: 'UTC',
    });
    connectionService.listConnections.mockResolvedValue([
      {
        id: 'conn-1',
        provider: 'GOOGLE',
        email: 'ana@example.com',
        isActive: true,
        syncedAt: null,
        createdAt: new Date('2026-04-08T08:00:00.000Z'),
      },
    ]);
    eventService.getSyncStatus.mockResolvedValue([
      {
        connectionId: 'conn-1',
        provider: 'GOOGLE',
        lastSyncedAt: null,
        lastAttempt: null,
      },
    ]);
    eventService.getUpcomingEvents.mockResolvedValue([
      {
        id: 'event-1',
        connectionId: 'conn-1',
        title: 'Board review',
        description: null,
        startAt: new Date('2026-04-08T11:30:00.000Z'),
        endAt: new Date('2026-04-08T12:30:00.000Z'),
        isAllDay: false,
        location: 'Faria Lima',
        meetingUrl: null,
        organizer: null,
        isCancelled: false,
        provider: 'GOOGLE',
      },
      {
        id: 'event-2',
        connectionId: 'conn-1',
        title: 'Client lunch',
        description: null,
        startAt: new Date('2026-04-08T14:00:00.000Z'),
        endAt: new Date('2026-04-08T15:00:00.000Z'),
        isAllDay: false,
        location: 'Jardins',
        meetingUrl: null,
        organizer: null,
        isCancelled: false,
        provider: 'GOOGLE',
      },
    ]);
    scheduleContextService.deriveContext.mockResolvedValue({
      userId: 'user-1',
      referenceDate: new Date('2026-04-08T12:00:00.000Z'),
      timezone: 'UTC',
      occupiedWindows: [],
      freeWindows: [
        {
          start: new Date('2026-04-08T12:30:00.000Z'),
          end: new Date('2026-04-08T14:00:00.000Z'),
          durationMinutes: 90,
          type: 'FREE',
          label: '90-min gap between meetings',
        },
      ],
      opportunityWindows: [
        {
          start: new Date('2026-04-08T12:30:00.000Z'),
          end: new Date('2026-04-08T14:00:00.000Z'),
          durationMinutes: 90,
          type: 'FREE',
          label: '90-min gap between meetings',
        },
      ],
      scheduleDensity: 'moderate',
      isPrimaryWorkDay: true,
      hasMealOpportunity: true,
      hasEveningFree: false,
      nextMeetingStartsAt: new Date('2026-04-08T14:00:00.000Z'),
      lastMeetingEndsAt: new Date('2026-04-08T15:00:00.000Z'),
    });

    const result = await service.getTodayOverview('user-1');

    expect(result.hasCalendarConnection).toBe(true);
    expect(result.needsInitialSync).toBe(true);
    expect(result.scheduleDensity).toBe('moderate');
    expect(result.summary.meetingCount).toBe(2);
    expect(result.events.map((event) => event.status)).toEqual(['in_progress', 'upcoming']);
    expect(result.freeWindows[0]).toMatchObject({
      durationMinutes: 90,
      label: '90-min gap between meetings',
    });
  });
});
