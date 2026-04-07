import { Test, TestingModule } from '@nestjs/testing';
import { CalendarSyncService } from '../services/calendar-sync.service';
import { CalendarConnectionService } from '../services/calendar-connection.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { GoogleCalendarProvider } from '../providers/google/google-calendar.provider';
import { MicrosoftCalendarProvider } from '../providers/microsoft/microsoft-calendar.provider';
import { ProviderTokenRevokedError, ProviderTransientError } from '../interfaces/calendar-provider.interface';

// Use string literals to avoid dependency on Prisma-generated enum until DB is available
const SyncStatus = { IN_PROGRESS: 'IN_PROGRESS', COMPLETED: 'COMPLETED', FAILED: 'FAILED' } as const;
const CalendarProvider = { GOOGLE: 'GOOGLE', MICROSOFT: 'MICROSOFT' } as const;

describe('CalendarSyncService', () => {
  let service: CalendarSyncService;
  let prisma: jest.Mocked<PrismaService>;
  let connectionService: jest.Mocked<CalendarConnectionService>;
  let googleProvider: jest.Mocked<GoogleCalendarProvider>;

  const mockConnection = {
    id: 'conn-1',
    provider: CalendarProvider.GOOGLE,
    refreshToken: 'encrypted-refresh',
    userId: 'user-1',
    syncCursor: null,
  };

  const mockEvent = {
    externalId: 'google-event-1',
    title: 'Strategy Session',
    description: 'Q3 planning',
    startAt: new Date('2026-04-07T14:00:00Z'),
    endAt: new Date('2026-04-07T15:30:00Z'),
    timezone: 'America/Sao_Paulo',
    isAllDay: false,
    location: 'Paulista 1000',
    meetingUrl: null,
    organizer: 'ceo@company.com',
    attendees: [],
    isCancelled: false,
    raw: {},
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const mockPrisma = {
      calendarSyncAttempt: {
        create: jest.fn(),
        update: jest.fn(),
      },
      calendarConnection: {
        findMany: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
      },
      calendarEvent: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn(),
    };

    const mockConnectionService = {
      getValidAccessToken: jest.fn(),
      listConnections: jest.fn(),
    };

    const mockGoogle = {
      providerName: 'Google Calendar',
      fetchEvents: jest.fn(),
    };

    const mockMicrosoft = {
      providerName: 'Microsoft Calendar',
      fetchEvents: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarSyncService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CalendarConnectionService, useValue: mockConnectionService },
        { provide: GoogleCalendarProvider, useValue: mockGoogle },
        { provide: MicrosoftCalendarProvider, useValue: mockMicrosoft },
      ],
    }).compile();

    service = module.get<CalendarSyncService>(CalendarSyncService);
    prisma = module.get(PrismaService);
    connectionService = module.get(CalendarConnectionService);
    googleProvider = module.get(GoogleCalendarProvider);
  });

  // ─── Happy path ────────────────────────────────────────────────────────────

  describe('syncConnection', () => {
    it('should create a sync attempt, sync events, and mark as COMPLETED', async () => {
      const syncAttempt = { id: 'attempt-1' };
      (prisma.calendarSyncAttempt.create as jest.Mock).mockResolvedValue(syncAttempt);
      (connectionService.getValidAccessToken as jest.Mock).mockResolvedValue({
        accessToken: 'valid-access-token',
        connection: mockConnection,
      });
      (googleProvider.fetchEvents as jest.Mock).mockResolvedValue({
        events: [mockEvent],
        nextSyncCursor: 'new-cursor',
      });
      // $transaction mock — execute the callback
      (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => cb(prisma));
      (prisma.calendarEvent.findUnique as jest.Mock).mockResolvedValue(null); // new event
      (prisma.calendarEvent.create as jest.Mock).mockResolvedValue({});
      (prisma.calendarConnection.update as jest.Mock).mockResolvedValue({});
      (prisma.calendarConnection.findUnique as jest.Mock).mockResolvedValue({ userId: 'user-1' });
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.syncConnection('conn-1', 'user');

      expect(result.syncAttemptId).toBe('attempt-1');
      expect(prisma.calendarSyncAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'attempt-1' },
          data: expect.objectContaining({ status: SyncStatus.COMPLETED, eventsAdded: 1 }),
        }),
      );
    });

    it('should update the sync cursor after successful sync', async () => {
      const syncAttempt = { id: 'attempt-2' };
      (prisma.calendarSyncAttempt.create as jest.Mock).mockResolvedValue(syncAttempt);
      (connectionService.getValidAccessToken as jest.Mock).mockResolvedValue({
        accessToken: 'token',
        connection: { ...mockConnection, syncCursor: null },
      });
      (googleProvider.fetchEvents as jest.Mock).mockResolvedValue({
        events: [],
        nextSyncCursor: 'cursor-abc',
      });
      (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => cb(prisma));
      (prisma.calendarConnection.update as jest.Mock).mockResolvedValue({});
      (prisma.calendarConnection.findUnique as jest.Mock).mockResolvedValue({ userId: 'user-1' });
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      await service.syncConnection('conn-1', 'scheduler');

      // Should update syncCursor to 'cursor-abc'
      expect(prisma.calendarConnection.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ syncCursor: 'cursor-abc' }),
        }),
      );
    });

    it('should update existing events instead of creating duplicates', async () => {
      const existingEvent = { id: 'db-event-1', ...mockEvent };
      const syncAttempt = { id: 'attempt-3' };

      (prisma.calendarSyncAttempt.create as jest.Mock).mockResolvedValue(syncAttempt);
      (connectionService.getValidAccessToken as jest.Mock).mockResolvedValue({
        accessToken: 'token',
        connection: mockConnection,
      });
      (googleProvider.fetchEvents as jest.Mock).mockResolvedValue({
        events: [{ ...mockEvent, title: 'Updated Title' }],
        nextSyncCursor: null,
      });
      (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => cb(prisma));
      (prisma.calendarEvent.findUnique as jest.Mock).mockResolvedValue(existingEvent);
      (prisma.calendarEvent.update as jest.Mock).mockResolvedValue({});
      (prisma.calendarConnection.update as jest.Mock).mockResolvedValue({});
      (prisma.calendarConnection.findUnique as jest.Mock).mockResolvedValue({ userId: 'user-1' });
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      await service.syncConnection('conn-1');

      expect(prisma.calendarEvent.update).toHaveBeenCalled();
      expect(prisma.calendarEvent.create).not.toHaveBeenCalled();
      expect(prisma.calendarSyncAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventsUpdated: 1, eventsAdded: 0 }),
        }),
      );
    });
  });

  // ─── Failure paths ─────────────────────────────────────────────────────────

  describe('failure paths', () => {
    it('should mark sync attempt as FAILED when provider throws transient error', async () => {
      // Bypass retry sleep delays
      jest.spyOn(service as never, 'sleep').mockResolvedValue(undefined as never);

      const syncAttempt = { id: 'attempt-fail-1' };
      (prisma.calendarSyncAttempt.create as jest.Mock).mockResolvedValue(syncAttempt);
      (connectionService.getValidAccessToken as jest.Mock).mockResolvedValue({
        accessToken: 'token',
        connection: mockConnection,
      });
      (googleProvider.fetchEvents as jest.Mock).mockRejectedValue(
        new ProviderTransientError('Google Calendar', 503, 'Service unavailable'),
      );
      (prisma.calendarConnection.findUnique as jest.Mock).mockResolvedValue({ userId: 'user-1' });
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      await expect(service.syncConnection('conn-1')).rejects.toThrow(ProviderTransientError);

      expect(prisma.calendarSyncAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: SyncStatus.FAILED }),
        }),
      );
    });

    it('should mark connection as inactive when token is revoked', async () => {
      const syncAttempt = { id: 'attempt-revoked' };
      (prisma.calendarSyncAttempt.create as jest.Mock).mockResolvedValue(syncAttempt);
      (connectionService.getValidAccessToken as jest.Mock).mockResolvedValue({
        accessToken: 'token',
        connection: mockConnection,
      });
      (googleProvider.fetchEvents as jest.Mock).mockRejectedValue(
        new ProviderTokenRevokedError('Google Calendar', 'Token revoked by user'),
      );
      (prisma.calendarConnection.update as jest.Mock).mockResolvedValue({});
      (prisma.calendarConnection.findUnique as jest.Mock).mockResolvedValue({ userId: 'user-1' });
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      await expect(service.syncConnection('conn-1')).rejects.toThrow(ProviderTokenRevokedError);

      // Connection must be deactivated
      expect(prisma.calendarConnection.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: false }),
        }),
      );
    });

    it('should fall back to full sync when sync cursor expires (410)', async () => {
      const syncAttempt = { id: 'attempt-410' };
      (prisma.calendarSyncAttempt.create as jest.Mock).mockResolvedValue(syncAttempt);
      (connectionService.getValidAccessToken as jest.Mock).mockResolvedValue({
        accessToken: 'token',
        connection: { ...mockConnection, syncCursor: 'expired-cursor' },
      });

      // First call with cursor → 410 error; second call (full sync) → success
      (googleProvider.fetchEvents as jest.Mock)
        .mockRejectedValueOnce(
          new ProviderTransientError('Google Calendar', 410, 'Sync token expired'),
        )
        .mockResolvedValueOnce({ events: [], nextSyncCursor: 'fresh-cursor' });

      (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => cb(prisma));
      (prisma.calendarConnection.update as jest.Mock).mockResolvedValue({});
      (prisma.calendarConnection.findUnique as jest.Mock).mockResolvedValue({ userId: 'user-1' });
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      await service.syncConnection('conn-1');

      // Cursor should be reset before full sync
      expect(prisma.calendarConnection.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ syncCursor: null }) }),
      );
      // Full sync should succeed
      expect(googleProvider.fetchEvents).toHaveBeenCalledTimes(2);
    });

    it('should mark cancelled events as isCancelled without counting as removed if not in DB', async () => {
      const cancelledEvent = { ...mockEvent, externalId: 'new-cancelled', isCancelled: true };
      const syncAttempt = { id: 'attempt-cancel' };

      (prisma.calendarSyncAttempt.create as jest.Mock).mockResolvedValue(syncAttempt);
      (connectionService.getValidAccessToken as jest.Mock).mockResolvedValue({
        accessToken: 'token',
        connection: mockConnection,
      });
      (googleProvider.fetchEvents as jest.Mock).mockResolvedValue({
        events: [cancelledEvent],
        nextSyncCursor: null,
      });
      (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => cb(prisma));
      (prisma.calendarEvent.findUnique as jest.Mock).mockResolvedValue(null); // not in DB
      (prisma.calendarConnection.update as jest.Mock).mockResolvedValue({});
      (prisma.calendarConnection.findUnique as jest.Mock).mockResolvedValue({ userId: 'user-1' });
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      await service.syncConnection('conn-1');

      // Should not try to create or update the event
      expect(prisma.calendarEvent.create).not.toHaveBeenCalled();
      expect(prisma.calendarEvent.update).not.toHaveBeenCalled();
    });
  });
});
