import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { Request } from 'express';
import { Role } from '@prisma/client';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { getClientIp } from '../common/client-ip';
import { rejectIfHoneypotFilled } from '../common/honeypot';
import {
  CreateReportFields,
  MAX_IMAGE_BYTES,
  ParseCreateReportFieldsPipe,
} from './dto/create-report.dto';
import { AssignReportDto } from './dto/assign-report.dto';
import { createCommentRequestSchema } from '@prizren/shared-types';
import { zodBody } from '../common/zod-validation.pipe';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ListReportsQueryDto } from './dto/list-reports-query.dto';
import { NearbyReportsQueryDto } from './dto/nearby-reports-query.dto';
import { UpdateAiClassificationDto } from './dto/update-ai-classification.dto';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';
import {
  AddReportNoteDto,
  EscalateReportDto,
  UpdateReportPriorityDto,
} from './dto/update-report-priority.dto';
import { WorkflowActionDto } from './dto/workflow-action.dto';
import { ModerateReportDto } from './dto/moderate-report.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
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
    rejectIfHoneypotFilled(fields.website);
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

  @Get('mine/stats')
  @UseGuards(JwtAuthGuard)
  myStats(@CurrentUser() user: AuthUser) {
    return this.reportsService.myStats(user.id);
  }

  @Get('queue')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DEPARTMENT_STAFF, Role.DEPARTMENT_ADMIN, Role.SUPER_ADMIN)
  listQueue(@Query() query: ListReportsQueryDto, @CurrentUser() user: AuthUser) {
    if (!user) {
      throw new BadRequestException('Unauthorized');
    }
    return this.reportsService.listQueue(user, query);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser | null) {
    return this.reportsService.findOne(id, user ?? null);
  }

  @Post(':id/votes')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  addVote(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    if (!user) {
      throw new BadRequestException('Unauthorized');
    }
    return this.reportsService.addVote(id, user);
  }

  @Delete(':id/votes')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  removeVote(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    if (!user) {
      throw new BadRequestException('Unauthorized');
    }
    return this.reportsService.removeVote(id, user);
  }

  @Get(':id/comments')
  @UseGuards(OptionalJwtAuthGuard)
  listComments(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser | null,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reportsService.listComments(
      id,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
      user ?? null,
    );
  }

  @Post(':id/comments')
  @UseGuards(JwtAuthGuard)
  addComment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body(zodBody(createCommentRequestSchema)) dto: CreateCommentDto,
  ) {
    if (!user) {
      throw new BadRequestException('Unauthorized');
    }
    return this.reportsService.addComment(id, user, dto.text);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DEPARTMENT_STAFF, Role.DEPARTMENT_ADMIN, Role.SUPER_ADMIN)
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateReportStatusDto,
    @Req() req: Request,
  ) {
    if (!user) {
      throw new BadRequestException('Unauthorized');
    }
    if (!dto?.status) {
      throw new BadRequestException('status is required');
    }
    return this.reportsService.updateStatus(id, user, dto, getClientIp(req));
  }

  @Post(':id/workflow')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DEPARTMENT_STAFF, Role.DEPARTMENT_ADMIN, Role.SUPER_ADMIN)
  applyWorkflow(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: WorkflowActionDto,
    @Req() req: Request,
  ) {
    if (!user) {
      throw new BadRequestException('Unauthorized');
    }
    if (!dto?.action) {
      throw new BadRequestException('action is required');
    }
    return this.reportsService.applyWorkflowAction(id, user, dto, getClientIp(req));
  }

  @Post(':id/moderate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DEPARTMENT_STAFF, Role.DEPARTMENT_ADMIN, Role.SUPER_ADMIN)
  moderate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ModerateReportDto,
    @Req() req: Request,
  ) {
    if (!user) {
      throw new BadRequestException('Unauthorized');
    }
    if (!dto?.action) {
      throw new BadRequestException('action is required');
    }
    return this.reportsService.moderate(id, user, dto, getClientIp(req));
  }

  @Patch(':id/assign')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DEPARTMENT_ADMIN, Role.SUPER_ADMIN)
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: AssignReportDto,
    @Req() req: Request,
  ) {
    if (!user) {
      throw new BadRequestException('Unauthorized');
    }
    return this.reportsService.assign(id, user, dto, getClientIp(req));
  }

  @Patch(':id/priority')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DEPARTMENT_STAFF, Role.DEPARTMENT_ADMIN, Role.SUPER_ADMIN)
  updatePriority(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateReportPriorityDto,
    @Req() req: Request,
  ) {
    if (!user) {
      throw new BadRequestException('Unauthorized');
    }
    return this.reportsService.updatePriority(id, user, dto, getClientIp(req));
  }

  @Patch(':id/escalate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DEPARTMENT_STAFF, Role.DEPARTMENT_ADMIN, Role.SUPER_ADMIN)
  escalate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: EscalateReportDto,
    @Req() req: Request,
  ) {
    if (!user) {
      throw new BadRequestException('Unauthorized');
    }
    return this.reportsService.escalate(id, user, dto, getClientIp(req));
  }

  @Post(':id/notes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DEPARTMENT_STAFF, Role.DEPARTMENT_ADMIN, Role.SUPER_ADMIN)
  addNote(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: AddReportNoteDto,
    @Req() req: Request,
  ) {
    if (!user) {
      throw new BadRequestException('Unauthorized');
    }
    return this.reportsService.addStaffNote(id, user, dto, getClientIp(req));
  }

  @Post(':id/photo-after')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DEPARTMENT_STAFF, Role.DEPARTMENT_ADMIN, Role.SUPER_ADMIN)
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMAGE_BYTES },
    }),
  )
  uploadPhotoAfter(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @UploadedFile() file?: Express.Multer.File,
    @Req() req?: Request,
  ) {
    if (!user) {
      throw new BadRequestException('Unauthorized');
    }
    if (!file) {
      throw new BadRequestException('photo is required');
    }
    return this.reportsService.uploadPhotoAfter(id, user, file, req ? getClientIp(req) : null);
  }

  @Patch(':id/ai-classification')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DEPARTMENT_ADMIN, Role.SUPER_ADMIN)
  updateAiClassification(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateAiClassificationDto,
    @Req() req: Request,
  ) {
    if (!user) {
      throw new BadRequestException('Unauthorized');
    }
    return this.reportsService.updateAiClassification(id, user, dto, getClientIp(req));
  }
}
