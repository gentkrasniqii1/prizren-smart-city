import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Role } from '@prisma/client';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  CreateReportFields,
  MAX_IMAGE_BYTES,
  ParseCreateReportFieldsPipe,
} from './dto/create-report.dto';
import { ListReportsQueryDto } from './dto/list-reports-query.dto';
import { NearbyReportsQueryDto } from './dto/nearby-reports-query.dto';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMAGE_BYTES },
    }),
  )
  create(
    @CurrentUser() user: AuthUser,
    @Body(ParseCreateReportFieldsPipe) fields: CreateReportFields,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!user) {
      throw new BadRequestException('Unauthorized');
    }
    if (!file) {
      throw new BadRequestException('photo is required');
    }
    return this.reportsService.create(user, fields, file);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  list(@Query() query: ListReportsQueryDto, @CurrentUser() user: AuthUser | null) {
    return this.reportsService.list(query, user ?? null);
  }

  @Get('nearby')
  @UseGuards(OptionalJwtAuthGuard)
  nearby(@Query() query: NearbyReportsQueryDto, @CurrentUser() user: AuthUser | null) {
    return this.reportsService.findNearby(query.lat, query.lng, query.radiusKm, user ?? null);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  listMine(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reportsService.listMine(user, page ? Number(page) : 1, limit ? Number(limit) : 20);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser | null) {
    return this.reportsService.findOne(id, user ?? null);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DEPARTMENT_STAFF, Role.DEPARTMENT_ADMIN, Role.SUPER_ADMIN)
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateReportStatusDto,
  ) {
    if (!dto?.status) {
      throw new BadRequestException('status is required');
    }
    return this.reportsService.updateStatus(id, user, dto);
  }
}
