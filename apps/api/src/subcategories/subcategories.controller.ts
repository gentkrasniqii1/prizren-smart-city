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
import { SubcategoriesService } from './subcategories.service';
import { UpsertSubcategoryDto } from './dto/upsert-subcategory.dto';

@Controller('subcategories')
export class SubcategoriesController {
  constructor(private readonly subcategories: SubcategoriesService) {}

  @Get()
  list(
    @Query('categoryId') categoryId?: string,
    @Query('includeInactive') includeInactive?: string,
    @Query('q') q?: string,
  ) {
    return this.subcategories.list({
      categoryId: categoryId || undefined,
      includeInactive: includeInactive === 'true',
      q: q || undefined,
    });
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DEPARTMENT_ADMIN, Role.SUPER_ADMIN)
  create(@CurrentUser() user: AuthUser, @Body() dto: UpsertSubcategoryDto, @Req() req: Request) {
    return this.subcategories.create(user, dto, getClientIp(req));
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DEPARTMENT_ADMIN, Role.SUPER_ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpsertSubcategoryDto,
    @Req() req: Request,
  ) {
    return this.subcategories.update(id, user, dto, getClientIp(req));
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.subcategories.remove(id, user, getClientIp(req));
  }
}
