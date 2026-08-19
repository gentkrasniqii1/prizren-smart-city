import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.DEPARTMENT_STAFF, Role.DEPARTMENT_ADMIN, Role.SUPER_ADMIN)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('summary')
  summary(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.summary(query);
  }

  @Get('by-category')
  byCategory(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.byCategory(query);
  }

  @Get('by-status')
  byStatus(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.byStatus(query);
  }

  @Get('by-department')
  byDepartment(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.byDepartment(query);
  }

  @Get('by-institution')
  byInstitution(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.byInstitution(query);
  }

  @Get('over-time')
  overTime(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.overTime(query);
  }

  @Get('sla')
  sla(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.sla(query);
  }
}
