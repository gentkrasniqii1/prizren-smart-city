import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('read') read?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const readFilter = read === 'unread' || read === 'read' || read === 'all' ? read : undefined;
    return this.notificationsService.listForUser(user.id, {
      unreadOnly: unreadOnly === 'true' || unreadOnly === '1',
      read: readFilter,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.notificationsService.markAllRead(user.id);
  }

  @Patch(':id/read')
  async markRead(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    const updated = await this.notificationsService.markRead(user.id, id);
    if (!updated) {
      throw new NotFoundException('Notification not found');
    }
    return updated;
  }
}
