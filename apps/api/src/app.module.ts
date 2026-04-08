import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { TerminusModule } from '@nestjs/terminus';
import { APP_GUARD } from '@nestjs/core';

import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { EncryptionModule } from './common/encryption/encryption.module';
import { AuthModule } from './modules/auth/auth.module';
import { AiModule } from './modules/ai/ai.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { RecommendationModule } from './modules/recommendation/recommendation.module';
import { ConciergeModule } from './modules/concierge/concierge.module';
import { TodayModule } from './modules/today/today.module';
import { UserModule } from './modules/user/user.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 10,
      },
      {
        name: 'medium',
        ttl: 60000,
        limit: 100,
      },
    ]),

    // Scheduled tasks
    ScheduleModule.forRoot(),

    // Health checks
    TerminusModule,

    // Database
    PrismaModule,

    // Security infrastructure (global — available in all modules)
    EncryptionModule,

    // Feature modules
    AuthModule,
    AiModule,
    CalendarModule,
    RecommendationModule,
    ConciergeModule,
    TodayModule,
    UserModule,
  ],
  controllers: [HealthController],
  providers: [
    // Global auth guard — everything is protected by default
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Global roles guard
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
