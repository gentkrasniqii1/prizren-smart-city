import { Controller, Get } from '@nestjs/common';
import type { InstitutionDto } from '@prizren/shared-types';
import { PrismaService } from '../prisma/prisma.service';

@Controller('institutions')
export class InstitutionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(): Promise<InstitutionDto[]> {
    const rows = await this.prisma.institution.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      type: row.type,
      contact: row.contact,
      active: row.active,
      integrationType: row.integrationType,
      integrationStatus: row.integrationStatus,
    }));
  }
}
