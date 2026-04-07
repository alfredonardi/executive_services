import { Injectable, Logger } from '@nestjs/common';
import { CalendarProvider } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

export interface GetEventsOptions {
  userId: string;
  from?: Date;
  to?: Date;
  provider?: CalendarProvider;
  limit?: number;
}

/**
 * CalendarEventService
 *
 * Provides the internal API for reading normalized calendar events.
 * This is the service that other modules (concierge chat, recommendations,
 * AI orchestration) should use — never query calendar_events directly.
 *
 * All methods return the normalized domain model, not database rows.
 * Raw provider payloads are never returned.
 */
@Injectable()
export class CalendarEventService {
  private readonly logger = new Logger(CalendarEventService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns upcoming events for a user across all active connections.
   * Default window: now → now+60d if not specified.
   */
  async getUpcomingEvents(options: GetEventsOptions) {
    const now = new Date();
    const from = options.from ?? now;
    const to = options.to ?? new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const limit = options.limit ?? 50;

    const connections = await this.prisma.calendarConnection.findMany({
      where: {
        userId: options.userId,
        isActive: true,
        ...(options.provider && { provider: options.provider }),
      },
      select: { id: true, provider: true },
    });

    if (connections.length === 0) return [];

    const connectionIds = connections.map((c) => c.id);
    const providerMap = new Map(connections.map((c) => [c.id, c.provider]));

    const events = await this.prisma.calendarEvent.findMany({
      where: {
        connectionId: { in: connectionIds },
        startAt: { gte: from },
        endAt: { lte: to },
        isCancelled: false,
      },
      select: {
        id: true,
        connectionId: true,
        title: true,
        description: true,
        startAt: true,
        endAt: true,
        isAllDay: true,
        location: true,
        meetingUrl: true,
        organizer: true,
        isCancelled: true,
      },
      orderBy: { startAt: 'asc' },
      take: limit,
    });

    return events.map((e) => ({
      ...e,
      provider: providerMap.get(e.connectionId) ?? null,
    }));
  }

  /**
   * Returns the sync status for all calendar connections of a user.
   */
  async getSyncStatus(userId: string) {
    const connections = await this.prisma.calendarConnection.findMany({
      where: { userId, isActive: true },
      select: {
        id: true,
        provider: true,
        syncedAt: true,
        syncAttempts: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            status: true,
            eventsAdded: true,
            eventsUpdated: true,
            eventsRemoved: true,
            errorMessage: true,
            createdAt: true,
          },
        },
      },
    });

    return connections.map((c) => ({
      connectionId: c.id,
      provider: c.provider,
      lastSyncedAt: c.syncedAt,
      lastAttempt: c.syncAttempts[0] ?? null,
    }));
  }
}
