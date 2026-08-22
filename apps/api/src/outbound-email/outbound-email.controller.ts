import { Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OutboundEmailService } from './outbound-email.service';
import { ListOutboundEmailQueryDto } from './dto/list-outbound-email-query.dto';

@Controller('outbound-emails')
export class OutboundEmailController {
  constructor(private readonly outbound: OutboundEmailService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DEPARTMENT_STAFF, Role.DEPARTMENT_ADMIN, Role.SUPER_ADMIN)
  list(@CurrentUser() user: AuthUser, @Query() query: ListOutboundEmailQueryDto) {
    return this.outbound.list(user, query);
  }

  @Post(':id/retry')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DEPARTMENT_ADMIN, Role.SUPER_ADMIN)
  retry(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.outbound.retry(id, user);
  }
}
