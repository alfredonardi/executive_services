import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { CalendarSyncService } from '../services/calendar-sync.service';

/**
 * CalendarSyncWorker
 *
 * Background job that periodically syncs all active calendar connections.
 * Runs every 30 minutes via a cron expression.
 *
 * Design decisions:
 * - Runs sequentially per connection (not in parallel) to avoid thundering herd
 *   against provider rate limits during the MVP phase.
 * - Errors are caught per connection and logged — one failing connection does not
 *   block others.
 * - The scheduler cadence (30 min) is a conservative default. In a future phase,
 *   this can be replaced with provider webhooks for near-real-time updates.
 *
 * Deferred:
 * - Distributed lock (Redis SETNX) to prevent duplicate runs in multi-instance deploys.
 *   For the MVP, a single instance is assumed. This is a known gap to address before
 *   horizontal scaling.
 */
@Injectable()
export class CalendarSyncWorker {
  private readonly logger = new Logger(CalendarSyncWorker.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly syncService: CalendarSyncService,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async runScheduledSync(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Scheduled sync skipped — previous run still in progress');
      return;
    }

    this.isRunning = true;
    const startedAt = Date.now();
    this.logger.log('Scheduled calendar sync started');

    try {
      const connections = await this.prisma.calendarConnection.findMany({
        where: { isActive: true },
        select: { id: true, userId: true, provider: true },
      });

      this.logger.log(`Syncing ${connections.length} active calendar connection(s)`);

      let succeeded = 0;
      let failed = 0;

      for (const connection of connections) {
        try {
          await this.syncService.syncConnection(connection.id, 'scheduler');
          succeeded++;
        } catch (err) {
          failed++;
          this.logger.error(
            `Scheduled sync failed for connection ${connection.id} (provider: ${connection.provider})`,
            err,
          );
        }
      }

      const elapsed = Date.now() - startedAt;
      this.logger.log(
        `Scheduled sync complete: ${succeeded} succeeded, ${failed} failed (${elapsed}ms)`,
      );
    } finally {
      this.isRunning = false;
    }
  }
}
