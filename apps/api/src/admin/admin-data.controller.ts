import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { getClientIp } from '../common/client-ip';
import { AdminDataService } from './admin-data.service';
import { ListAdminDataQueryDto } from './dto/list-admin-data-query.dto';
import { UpsertSlaPolicyDto } from './dto/upsert-sla-policy.dto';

@Controller('admin/data')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class AdminDataController {
  constructor(private readonly data: AdminDataService) {}

  @Post('sla-policies')
  createSla(@CurrentUser() user: AuthUser, @Body() dto: UpsertSlaPolicyDto, @Req() req: Request) {
    return this.data.createSlaPolicy(user, dto, getClientIp(req));
  }

  @Patch('sla-policies/:id')
  updateSla(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpsertSlaPolicyDto,
    @Req() req: Request,
  ) {
    return this.data.updateSlaPolicy(id, user, dto, getClientIp(req));
  }

  @Delete('sla-policies/:id')
  removeSla(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.data.removeSlaPolicy(id, user, getClientIp(req));
  }

  @Get(':resource')
  list(@Param('resource') resource: string, @Query() query: ListAdminDataQueryDto) {
    const key = this.data.assertResource(resource);
    return this.data.list(key, {
      page: query.page,
      limit: query.limit,
      q: query.q,
    });
  }
}
