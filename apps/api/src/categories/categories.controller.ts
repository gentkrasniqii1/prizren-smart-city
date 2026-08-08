import { Controller, Get } from '@nestjs/common';
import type { CategoryDto } from '@prizren/shared-types';
import { PrismaService } from '../prisma/prisma.service';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(): Promise<CategoryDto[]> {
    const rows = await this.prisma.category.findMany({
      include: { department: { select: { name: true } } },
      orderBy: { name: 'asc' },
    });

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      departmentId: row.departmentId,
      departmentName: row.department.name,
    }));
  }
}
