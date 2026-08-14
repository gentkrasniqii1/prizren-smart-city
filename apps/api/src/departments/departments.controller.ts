import { Controller, Get } from '@nestjs/common';
import type { DepartmentDto } from '@prizren/shared-types';
import { PrismaService } from '../prisma/prisma.service';

@Controller('departments')
export class DepartmentsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(): Promise<DepartmentDto[]> {
    const rows = await this.prisma.department.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        contact: true,
        slaHours: true,
        institutionId: true,
        institution: { select: { name: true } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      contact: row.contact,
      slaHours: row.slaHours,
      institutionId: row.institutionId,
      institutionName: row.institution?.name ?? null,
    }));
  }
}
