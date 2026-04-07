import { Injectable, Logger } from '@nestjs/common';
import { CalendarProvider, Prisma, SyncStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CalendarConnectionService } from './calendar-connection.service';
import { GoogleCalendarProvider } from '../providers/google/google-calendar.provider';
import { MicrosoftCalendarProvider } from '../providers/microsoft/microsoft-calendar.provider';
import {
  ICalendarProvider,
  ProviderTokenRevokedError,
  ProviderTransientError,
} from '../interfaces/calendar-provider.interface';
import { NormalizedCalendarEvent } from '../domain/calendar-event.model';

/** Look-ahead window for event fetching: today ± this many days */
const SYNC_WINDOW_DAYS_PAST = 7;
const SYNC_WINDOW_DAYS_FUTURE = 60;

/** Retry configuration for transient provider errors */
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 2000;

/**
 * CalendarSyncService
 *
 * Orchestrates the synchronization of calendar events from external providers
 * into the internal database.
 *
 * Sync strategy (Phase 2 — read-only):
 * - First sync: full event fetch within the configured time window
 * - Subsequent syncs: incremental using provider-native cursors where available
 *   (Google: nextSyncToken, Microsoft: deltaLink)
 * - If the cursor is invalid (provider returns 410 Gone), falls back to full sync
 * - All syncs are audited in CalendarSyncAttempt
 *
 * Safety guarantees:
 * - Sync is re-entrance safe: a sync already in progress will not be started again
 *   (enforced at the worker level via the cron schedule interval)
 * - Token refresh is handled transparently before each sync
 * - Revoked tokens mark the connection as inactive — user is expected to reconnect
 * - No data is written back to the provider
 *
 * Deferred (Phase 3+):
 * - Webhook-based push sync (Google push channels, Microsoft Graph subscriptions)
 * - Bidirectional sync
 * - Conflict resolution
 */
@Injectable()
export class CalendarSyncService {
  private readonly logger = new Logger(CalendarSyncService.name);

  private readonly providers: Record<CalendarProvider, ICalendarProvider>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly connectionService: CalendarConnectionService,
    google: GoogleCalendarProvider,
    microsoft: MicrosoftCalendarProvider,
  ) {
    this.providers = {
      GOOGLE: google,
      MICROSOFT: microsoft,
    };
  }

  /**
   * Syncs a single calendar connection. Called both by the scheduler and on-demand.
   * @param connectionId the connection to sync
   * @param triggeredBy  "scheduler" | "user" | "connection"
   */
  async syncConnection(
    connectionId: string,
    triggeredBy: string = 'scheduler',
  ): Promise<{ syncAttemptId: string }> {
    const startedAt = Date.now();

    const attempt = await this.prisma.calendarSyncAttempt.create({
      data: { connectionId, status: SyncStatus.IN_PROGRESS, triggeredBy },
    });

    this.logger.log(
      `Sync started: connection=${connectionId} attempt=${attempt.id} by=${triggeredBy}`,
    );

    await this.writeAuditLog(connectionId, 'CALENDAR_SYNC_STARTED', { triggeredBy });

    try {
      const result = await this.performSync(connectionId);

      const durationMs = Date.now() - startedAt;
      await this.prisma.calendarSyncAttempt.update({
        where: { id: attempt.id },
        data: {
          status: SyncStatus.COMPLETED,
          eventsAdded: result.added,
          eventsUpdated: result.updated,
          eventsRemoved: result.removed,
          durationMs,
        },
      });

      await this.prisma.calendarConnection.update({
        where: { id: connectionId },
        data: { syncedAt: new Date() },
      });

      await this.writeAuditLog(connectionId, 'CALENDAR_SYNC_COMPLETED', {
        ...result,
        durationMs,
      });

      this.logger.log(
        `Sync completed: connection=${connectionId} +${result.added} ~${result.updated} -${result.removed} (${durationMs}ms)`,
      );

      return { syncAttemptId: attempt.id };
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      const errorMessage = err instanceof Error ? err.message : String(err);
      const isRevoked = err instanceof ProviderTokenRevokedError;

      await this.prisma.calendarSyncAttempt.update({
        where: { id: attempt.id },
        data: {
          status: SyncStatus.FAILED,
          errorMessage,
          durationMs,
        },
      });

      if (isRevoked) {
        // Mark connection as inactive — user must reconnect
        await this.prisma.calendarConnection.update({
          where: { id: connectionId },
          data: { isActive: false, disconnectedAt: new Date() },
        });
        this.logger.warn(`Connection deactivated due to revoked token: ${connectionId}`);
      }

      await this.writeAuditLog(connectionId, 'CALENDAR_SYNC_FAILED', { errorMessage, isRevoked });

      this.logger.error(`Sync failed: connection=${connectionId}`, err);

      throw err;
    }
  }

  /**
   * Syncs all active calendar connections for a given user.
   */
  async syncAllForUser(userId: string): Promise<void> {
    const connections = await this.prisma.calendarConnection.findMany({
      where: { userId, isActive: true },
      select: { id: true },
    });

    for (const { id } of connections) {
      try {
        await this.syncConnection(id, 'user');
      } catch (err) {
        // Errors are already logged and audited per connection — continue with next
        this.logger.error(`Sync failed for connection ${id}, continuing`, err);
      }
    }
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  private async performSync(connectionId: string) {
    const { accessToken, connection } =
      await this.connectionService.getValidAccessToken(connectionId);

    const provider = this.providers[connection.provider];

    const now = new Date();
    const timeMin = new Date(now.getTime() - SYNC_WINDOW_DAYS_PAST * 24 * 60 * 60 * 1000);
    const timeMax = new Date(now.getTime() + SYNC_WINDOW_DAYS_FUTURE * 24 * 60 * 60 * 1000);

    let result = { added: 0, updated: 0, removed: 0 };

    try {
      const page = await this.fetchWithRetry(provider, accessToken, {
        timeMin,
        timeMax,
        syncCursor: connection.syncCursor,
      });

      result = await this.persistEvents(connectionId, page.events);

      // Persist the new sync cursor for next incremental sync
      if (page.nextSyncCursor !== undefined) {
        await this.prisma.calendarConnection.update({
          where: { id: connectionId },
          data: { syncCursor: page.nextSyncCursor },
        });
      }
    } catch (err) {
      if (err instanceof ProviderTransientError && err.statusCode === 410) {
        // Cursor expired — fall back to full sync
        this.logger.warn(`Cursor expired for ${connectionId}, performing full sync`);
        await this.prisma.calendarConnection.update({
          where: { id: connectionId },
          data: { syncCursor: null },
        });
        const page = await this.fetchWithRetry(provider, accessToken, { timeMin, timeMax });
        result = await this.persistEvents(connectionId, page.events);
        if (page.nextSyncCursor !== undefined) {
          await this.prisma.calendarConnection.update({
            where: { id: connectionId },
            data: { syncCursor: page.nextSyncCursor },
          });
        }
      } else {
        throw err;
      }
    }

    return result;
  }

  private async fetchWithRetry(
    provider: ICalendarProvider,
    accessToken: string,
    options: Parameters<ICalendarProvider['fetchEvents']>[1],
  ) {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await provider.fetchEvents(accessToken, options);
      } catch (err) {
        if (err instanceof ProviderTokenRevokedError) throw err; // non-retryable
        if (err instanceof ProviderTransientError && err.statusCode === 410) throw err; // handled above

        lastError = err instanceof Error ? err : new Error(String(err));
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        this.logger.warn(
          `Provider fetch failed (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${delay}ms`,
        );
        await this.sleep(delay);
      }
    }
    throw lastError;
  }

  /**
   * Upserts normalized events into the database.
   * Returns counts of added, updated, and removed events.
   */
  private async persistEvents(
    connectionId: string,
    events: NormalizedCalendarEvent[],
  ): Promise<{ added: number; updated: number; removed: number }> {
    let added = 0;
    let updated = 0;
    let removed = 0;

    // Batch upsert using Prisma transactions
    await this.prisma.$transaction(async (tx) => {
      for (const event of events) {
        const existing = await tx.calendarEvent.findUnique({
          where: {
            connectionId_externalId: { connectionId, externalId: event.externalId },
          },
        });

        if (event.isCancelled && existing) {
          await tx.calendarEvent.update({
            where: { id: existing.id },
            data: { isCancelled: true },
          });
          removed++;
          continue;
        }

        if (event.isCancelled && !existing) {
          // Cancelled event we never stored — skip
          continue;
        }

        const data = {
          title: event.title,
          description: event.description,
          startAt: event.startAt,
          endAt: event.endAt,
          location: event.location,
          isAllDay: event.isAllDay,
          isCancelled: event.isCancelled,
          meetingUrl: event.meetingUrl,
          organizer: event.organizer,
          attendees: event.attendees as never,
          raw: event.raw as never,
        };

        if (existing) {
          await tx.calendarEvent.update({ where: { id: existing.id }, data });
          updated++;
        } else {
          await tx.calendarEvent.create({
            data: { connectionId, externalId: event.externalId, ...data },
          });
          added++;
        }
      }
    });

    return { added, updated, removed };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async writeAuditLog(
    connectionId: string,
    action: string,
    metadata: Prisma.InputJsonValue,
  ) {
    try {
      // Fetch userId from connection for audit
      const conn = await this.prisma.calendarConnection.findUnique({
        where: { id: connectionId },
        select: { userId: true },
      });
      if (conn) {
        await this.prisma.auditLog.create({
          data: {
            actorId: conn.userId,
            subjectId: connectionId,
            subjectType: 'CalendarConnection',
            action: action as never,
            metadata,
          },
        });
      }
    } catch (err) {
      this.logger.error('Failed to write audit log', err);
    }
  }
}
