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
import type { InstitutionDto } from '@prizren/shared-types';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { getClientIp } from '../common/client-ip';
import { InstitutionsService } from './institutions.service';
import { UpsertInstitutionDto } from './dto/upsert-institution.dto';

@Controller('institutions')
export class InstitutionsController {
  constructor(private readonly institutions: InstitutionsService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  list(
    @Query('includeInactive') includeInactive: string | undefined,
    @CurrentUser() user: AuthUser | null,
  ): Promise<InstitutionDto[]> {
    const staff =
      user?.role === Role.DEPARTMENT_STAFF ||
      user?.role === Role.DEPARTMENT_ADMIN ||
      user?.role === Role.SUPER_ADMIN;
    return this.institutions.list(staff && includeInactive === 'true', Boolean(staff));
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DEPARTMENT_ADMIN, Role.SUPER_ADMIN)
  create(@CurrentUser() user: AuthUser, @Body() dto: UpsertInstitutionDto, @Req() req: Request) {
    return this.institutions.create(user, dto, getClientIp(req));
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DEPARTMENT_ADMIN, Role.SUPER_ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpsertInstitutionDto,
    @Req() req: Request,
  ) {
    return this.institutions.update(id, user, dto, getClientIp(req));
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.institutions.remove(id, user, getClientIp(req));
  }
}
