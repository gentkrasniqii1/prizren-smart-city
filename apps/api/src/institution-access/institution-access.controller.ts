import { Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { InstitutionAccessService } from './institution-access.service';

@Controller('institution-access')
export class InstitutionAccessController {
  constructor(private readonly access: InstitutionAccessService) {}

  @Post(':id/revoke')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DEPARTMENT_ADMIN, Role.SUPER_ADMIN)
  revoke(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.access.revoke(id, user);
  }

  @Get(':token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DEPARTMENT_STAFF, Role.DEPARTMENT_ADMIN, Role.SUPER_ADMIN)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  resolve(@Param('token') token: string, @CurrentUser() user: AuthUser) {
    return this.access.resolve(token, user);
  }
}
