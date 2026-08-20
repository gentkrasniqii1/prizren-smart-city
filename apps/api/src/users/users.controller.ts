import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
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
import { updateProfileRequestSchema } from '@prizren/shared-types';
import { zodBody } from '../common/zod-validation.pipe';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly audit: AuditService,
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
