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
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { getClientIp } from '../common/client-ip';
import { RoutingService } from './routing.service';
import { RoutingRulesService } from './routing-rules.service';
import { UpsertRoutingRuleDto } from './dto/upsert-routing-rule.dto';
import { RoutePreviewQueryDto } from './dto/route-preview-query.dto';

@Controller()
export class RoutingController {
  constructor(
    private readonly routing: RoutingService,
    private readonly rules: RoutingRulesService,
  ) {}

  @Get('routing/preview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DEPARTMENT_STAFF, Role.DEPARTMENT_ADMIN, Role.SUPER_ADMIN)
  preview(@Query() query: RoutePreviewQueryDto) {
    return this.routing.preview({
      categoryId: query.categoryId,
      subcategoryId: query.subcategoryId,
      subcategory: query.subcategory,
      severity: query.severity,
      zoneId: query.zoneId,
      zone: query.zone,
      isEmergency: query.isEmergency,
    });
  }

  @Get('routing-rules')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DEPARTMENT_STAFF, Role.DEPARTMENT_ADMIN, Role.SUPER_ADMIN)
  list() {
    return this.rules.list();
  }

  @Post('routing-rules')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DEPARTMENT_ADMIN, Role.SUPER_ADMIN)
  create(@CurrentUser() user: AuthUser, @Body() dto: UpsertRoutingRuleDto, @Req() req: Request) {
    return this.rules.create(user, dto, getClientIp(req));
  }

  @Patch('routing-rules/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DEPARTMENT_ADMIN, Role.SUPER_ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpsertRoutingRuleDto,
    @Req() req: Request,
  ) {
    return this.rules.update(id, user, dto, getClientIp(req));
  }

  @Delete('routing-rules/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.rules.remove(id, user, getClientIp(req));
  }
}
