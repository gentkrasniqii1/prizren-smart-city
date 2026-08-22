import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InstitutionAccessPurpose, Role } from '@prisma/client';
import type {
  InstitutionAccessResolveDto,
  InstitutionAccessRevokeDto,
} from '@prizren/shared-types';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { ConfigService } from '../auth/config.service';
import { randomToken, sha256Hex } from '../auth/crypto';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { STAFF_ROLES } from '../reports/visibility';

const PURPOSE = InstitutionAccessPurpose.INSTITUTION_NEW_CASE;

@Injectable()
export class InstitutionAccessService {
  private readonly logger = new Logger(InstitutionAccessService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async issue(params: {
    reportId: string;
    institutionId: string;
    actorUserId: string;
    purpose?: InstitutionAccessPurpose;
  }): Promise<{ id: string; raw: string; expiresAt: Date }> {
    const purpose = params.purpose ?? PURPOSE;
    await this.prisma.institutionAccessToken.updateMany({
      where: { reportId: params.reportId, purpose, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    const raw = randomToken(32);
    const expiresAt = new Date(
      Date.now() + this.config.institutionAccessTtlDays * 24 * 60 * 60 * 1000,
    );
    const created = await this.prisma.institutionAccessToken.create({
      data: {
        tokenHash: sha256Hex(raw),
        reportId: params.reportId,
        institutionId: params.institutionId,
        purpose,
        expiresAt,
      },
    });

    await this.audit.log({
      userId: params.actorUserId,
      action: 'institution_access.issue',
      entityType: 'InstitutionAccessToken',
      entityId: created.id,
      metadata: {
        reportId: params.reportId,
        institutionId: params.institutionId,
        purpose,
        expiresAt: expiresAt.toISOString(),
      },
    });

    return { id: created.id, raw, expiresAt };
  }

  async revokeQuiet(id: string): Promise<void> {
    await this.prisma.institutionAccessToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async resolve(rawToken: string, user: AuthUser): Promise<InstitutionAccessResolveDto> {
    if (!STAFF_ROLES.includes(user.role as Role)) {
      throw new ForbiddenException('Only staff/admin can open an institutional case link');
    }

    const row = await this.prisma.institutionAccessToken.findUnique({
      where: { tokenHash: sha256Hex(rawToken) },
      include: {
        report: { select: { publicId: true } },
        institution: { select: { name: true } },
      },
    });
    if (!row || row.revokedAt || row.expiresAt.getTime() <= Date.now()) {
      throw new NotFoundException('Institutional link is invalid or expired');
    }

    await this.assertMembership(user, row.institutionId);

    await this.prisma.institutionAccessToken.update({
      where: { id: row.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      reportId: row.reportId,
      publicId: row.report.publicId,
      institutionId: row.institutionId,
      institutionName: row.institution.name,
      expiresAt: row.expiresAt.toISOString(),
    };
  }

  async revoke(id: string, user: AuthUser): Promise<InstitutionAccessRevokeDto> {
    if (user.role !== Role.DEPARTMENT_ADMIN && user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Only department admin or super admin can revoke institutional links',
      );
    }

    const existing = await this.prisma.institutionAccessToken.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Institutional link not found');
    }
    await this.assertMembership(user, existing.institutionId);

    const revokedAt = existing.revokedAt ?? new Date();
    if (!existing.revokedAt) {
      await this.prisma.institutionAccessToken.update({
        where: { id },
        data: { revokedAt },
      });
      await this.audit.log({
        userId: user.id,
        action: 'institution_access.revoke',
        entityType: 'InstitutionAccessToken',
        entityId: id,
        metadata: { reportId: existing.reportId },
      });
    }

    return { id, revokedAt: revokedAt.toISOString() };
  }

  private async assertMembership(user: AuthUser, institutionId: string) {
    if (user.role === Role.SUPER_ADMIN) return;
    const membership = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { departments: { select: { institutionId: true } } },
    });
    const allowed = (membership?.departments ?? []).some((d) => d.institutionId === institutionId);
    if (!allowed) {
      this.logger.warn(`User ${user.id} is not a member of institution ${institutionId}`);
      throw new ForbiddenException('This link belongs to another institution');
    }
  }
}
