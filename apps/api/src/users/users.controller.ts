import { Controller, Get, NotFoundException, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

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
}
