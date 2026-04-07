import { Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { NotificationService } from '../services/notification.service';
import { ListNotificationsQueryDto } from '../dto/concierge.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @Roles('EXECUTIVE')
  @ApiOperation({ summary: 'List notifications for the current user' })
  async listNotifications(
    @CurrentUser() user: { id: string },
    @Query() query: ListNotificationsQueryDto,
  ) {
    return this.notificationService.listNotifications(user.id, query.unreadOnly);
  }

  @Patch(':id/read')
  @Roles('EXECUTIVE')
  @ApiOperation({ summary: 'Mark a notification as read' })
  async markAsRead(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.notificationService.markAsRead(id, user.id);
  }

  @Post('read-all')
  @Roles('EXECUTIVE')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@CurrentUser() user: { id: string }) {
    await this.notificationService.markAllAsRead(user.id);
    return { success: true };
  }
}
