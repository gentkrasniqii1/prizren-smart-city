import { Controller, Get, NotFoundException, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
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
}
