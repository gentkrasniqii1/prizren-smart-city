import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { getClientIp } from '../common/client-ip';
import { AuditService } from '../audit/audit.service';
import { updateProfileRequestSchema, setAccountEmailRequestSchema } from '@prizren/shared-types';
import { zodBody } from '../common/zod-validation.pipe';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { MAX_IMAGE_BYTES } from '../reports/dto/create-report.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly audit: AuditService,
    private readonly usersService: UsersService,
  ) {}

  @Get('me')
  async me(@CurrentUser() authUser: AuthUser) {
    if (!authUser) {
      throw new NotFoundException('User not found');
    }
    const user = await this.prisma.user.findUnique({ where: { id: authUser.id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.authService.toPublicUser(user);
  }

  @Patch('me')
  async updateMe(
    @CurrentUser() authUser: AuthUser,
    @Body(zodBody(updateProfileRequestSchema)) dto: UpdateProfileDto,
    @Req() req: Request,
  ) {
    if (!authUser) {
      throw new NotFoundException('User not found');
    }
    const firstName = dto.firstName.trim();
    const lastName = dto.lastName.trim();
    const phone = dto.phone?.trim() || null;

    const updated = await this.prisma.user.update({
      where: { id: authUser.id },
      data: {
        firstName,
        lastName,
        phone,
        name: `${firstName} ${lastName}`.trim(),
      },
    });

    await this.audit.log({
      userId: authUser.id,
      action: 'user.profile_update',
      entityType: 'User',
      entityId: authUser.id,
      ipAddress: getClientIp(req),
    });

    return this.authService.toPublicUser(updated);
  }

  @Patch('me/email')
  async setEmail(
    @CurrentUser() authUser: AuthUser,
    @Body(zodBody(setAccountEmailRequestSchema)) dto: { email: string },
    @Req() req: Request,
  ) {
    if (!authUser) {
      throw new NotFoundException('User not found');
    }
    const updated = await this.authService.setAccountEmail(authUser.id, dto.email);
    await this.audit.log({
      userId: authUser.id,
      action: 'user.email_set',
      entityType: 'User',
      entityId: authUser.id,
      ipAddress: getClientIp(req),
    });
    return updated;
  }

  @Patch('me/avatar')
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMAGE_BYTES },
    }),
  )
  async updateAvatar(
    @CurrentUser() authUser: AuthUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: Request,
  ) {
    if (!authUser) {
      throw new NotFoundException('User not found');
    }
    if (!file) {
      throw new BadRequestException('avatar is required');
    }
    const updated = await this.usersService.updateAvatar(authUser.id, file);
    await this.audit.log({
      userId: authUser.id,
      action: 'user.avatar_update',
      entityType: 'User',
      entityId: authUser.id,
      ipAddress: getClientIp(req),
    });
    return updated;
  }

  @Delete('me/avatar')
  async removeAvatar(@CurrentUser() authUser: AuthUser, @Req() req: Request) {
    if (!authUser) {
      throw new NotFoundException('User not found');
    }
    const updated = await this.usersService.removeAvatar(authUser.id);
    await this.audit.log({
      userId: authUser.id,
      action: 'user.avatar_remove',
      entityType: 'User',
      entityId: authUser.id,
      ipAddress: getClientIp(req),
    });
    return updated;
  }

  @Get('staff')
  @UseGuards(RolesGuard)
  @Roles(Role.DEPARTMENT_ADMIN, Role.SUPER_ADMIN)
  async listStaff() {
    const rows = await this.prisma.user.findMany({
      where: {
        role: {
          in: [Role.DEPARTMENT_STAFF, Role.DEPARTMENT_ADMIN, Role.SUPER_ADMIN],
        },
      },
      orderBy: { name: 'asc' },
    });
    return rows.map((row) => this.authService.toPublicUser(row));
  }

  @Patch(':id/role')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
    @Body() dto: UpdateUserRoleDto,
    @Req() req: Request,
  ) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: {
          role: dto.role,
          ...(dto.departmentIds
            ? {
                departments: {
                  set: dto.departmentIds.map((departmentId) => ({ id: departmentId })),
                },
              }
            : {}),
        },
      });

      await this.audit.log(
        {
          userId: actor.id,
          action: 'user.role_update',
          entityType: 'User',
          entityId: id,
          ipAddress: getClientIp(req),
          metadata: {
            oldRole: existing.role,
            newRole: dto.role,
            departmentIds: dto.departmentIds ?? null,
          },
        },
        tx,
      );

      return user;
    });

    return this.authService.toPublicUser(updated);
  }
}
