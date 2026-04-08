import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { TodayResponseDto } from './dto/today.dto';
import { TodayService } from './today.service';

@ApiTags('Today')
@ApiBearerAuth()
@Controller('today')
export class TodayController {
  constructor(private readonly todayService: TodayService) {}

  @Get()
  @Roles('EXECUTIVE')
  @ApiOperation({ summary: "Get the executive's live Today view" })
  @ApiResponse({ status: 200, type: TodayResponseDto })
  getToday(@CurrentUser('id') userId: string): Promise<TodayResponseDto> {
    return this.todayService.getTodayOverview(userId);
  }
}
