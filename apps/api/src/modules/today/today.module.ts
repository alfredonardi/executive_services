import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { CalendarModule } from '../calendar/calendar.module';
import { RecommendationModule } from '../recommendation/recommendation.module';
import { TodayController } from './today.controller';
import { TodayService } from './today.service';

@Module({
  imports: [PrismaModule, CalendarModule, RecommendationModule],
  controllers: [TodayController],
  providers: [TodayService],
})
export class TodayModule {}
