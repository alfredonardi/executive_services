import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CalendarController } from './calendar.controller';
import { CalendarConnectionService } from './services/calendar-connection.service';
import { CalendarSyncService } from './services/calendar-sync.service';
import { CalendarEventService } from './services/calendar-event.service';
import { CalendarSyncWorker } from './workers/calendar-sync.worker';
import { GoogleCalendarProvider } from './providers/google/google-calendar.provider';
import { MicrosoftCalendarProvider } from './providers/microsoft/microsoft-calendar.provider';
import { PrismaModule } from '../../prisma/prisma.module';

/**
 * CalendarModule
 *
 * Encapsulates all calendar integration logic:
 * - OAuth connection flows (Google + Microsoft)
 * - Token lifecycle management (storage, refresh, revocation)
 * - Event sync and normalization
 * - Scheduled background sync
 *
 * Provider adapters are instantiated with credentials from ConfigService.
 * This keeps the rest of the module ignorant of provider-specific configuration.
 *
 * The EncryptionModule is global, so EncryptionService is available here
 * without explicit import.
 */
@Module({
  imports: [PrismaModule],
  controllers: [CalendarController],
  providers: [
    // Provider adapters — constructed with credentials from config
    {
      provide: GoogleCalendarProvider,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new GoogleCalendarProvider(
          config.get<string>('google.clientId') ?? '',
          config.get<string>('google.clientSecret') ?? '',
        ),
    },
    {
      provide: MicrosoftCalendarProvider,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new MicrosoftCalendarProvider(
          config.get<string>('microsoft.clientId') ?? '',
          config.get<string>('microsoft.clientSecret') ?? '',
        ),
    },
    // Services
    CalendarConnectionService,
    CalendarSyncService,
    CalendarEventService,
    // Background worker
    CalendarSyncWorker,
  ],
  // Export services for use by other modules (e.g., AI module reading user calendar)
  exports: [CalendarEventService, CalendarConnectionService],
})
export class CalendarModule {}
