import { BadRequestException, Injectable } from '@nestjs/common';
import { Priority } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type RoutedAssignment = {
  categoryId: string;
  departmentId: string;
  institutionId: string | null;
  slaHours: number;
  defaultPriority: Priority;
};

@Injectable()
export class RoutingService {
  constructor(private readonly prisma: PrismaService) {}

  async routeByCategory(categoryId: string | undefined | null): Promise<RoutedAssignment | null> {
    if (!categoryId) return null;
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      include: {
        department: { include: { institution: true } },
      },
    });
    if (!category) {
      throw new BadRequestException('Invalid categoryId');
    }
    return {
      categoryId: category.id,
      departmentId: category.departmentId,
      institutionId: category.department.institutionId,
      slaHours: category.slaHours || category.department.slaHours || 48,
      defaultPriority: category.defaultPriority,
    };
  }
}
