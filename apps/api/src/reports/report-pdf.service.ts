import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InstitutionAccessPurpose, ReportStatus, Role } from '@prisma/client';
import { PUBLIC_REPORT_STATUSES } from '@prizren/shared-types';
import PDFDocument from 'pdfkit';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { ConfigService } from '../auth/config.service';
import { InstitutionAccessService } from '../institution-access/institution-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { STAFF_ROLES } from './visibility';
import { resolveReportMedia } from './report-media';

const STATUS_LABELS_SQ: Record<string, string> = {
  ASSIGNED: 'Në radhën e institucionit',
  RECEIVED: 'I pranuar nga institucioni',
  IN_PROGRESS: 'Në hetim',
  WAITING_FOR_INFORMATION: 'Në pritje të informacionit',
  RESOLVED: 'I zgjidhur',
};

@Injectable()
export class ReportPdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly access: InstitutionAccessService,
  ) {}

  async buildOfficialPdf(
    id: string,
    user: AuthUser,
  ): Promise<{ buffer: Buffer; filename: string }> {
    if (!STAFF_ROLES.includes(user.role as Role)) {
      throw new ForbiddenException('Only staff/admin can download the official case PDF');
    }

    const report = await this.prisma.report.findUnique({
      where: { id },
      include: {
        category: { select: { name: true } },
        department: { select: { name: true } },
        institution: { select: { name: true } },
        media: { orderBy: [{ role: 'asc' }, { sortOrder: 'asc' }] },
        statusHistory: { orderBy: { changedAt: 'asc' } },
      },
    });
    if (!report) {
      throw new NotFoundException('Report not found');
    }
    if (!(PUBLIC_REPORT_STATUSES as ReportStatus[]).includes(report.status)) {
      throw new BadRequestException('PDF is available only after the case is approved and routed');
    }

    let secureUrl: string | null = null;
    if (report.institutionId) {
      const token = await this.access.issue({
        reportId: report.id,
        institutionId: report.institutionId,
        actorUserId: user.id,
        purpose: InstitutionAccessPurpose.INSTITUTION_CASE_PDF,
      });
      secureUrl = `${this.config.webOrigin}/institution/reports/${token.raw}`;
    }

    const approvedAt =
      report.statusHistory.find((row) => row.newStatus === ReportStatus.ASSIGNED)?.changedAt ??
      null;
    const media = resolveReportMedia({
      media: report.media,
      photoUrl: report.photoUrl,
      photoAfterUrl: report.photoAfterUrl,
      staff: true,
    }).filter((row) => row.role === 'INITIAL' || row.role === 'AFTER');

    const location = report.address?.trim()
      ? report.address.trim()
      : `${report.lat.toFixed(5)}, ${report.lng.toFixed(5)}`;

    const buffer = await this.render({
      publicId: report.publicId,
      categoryName: report.category?.name ?? '—',
      departmentName: report.department?.name ?? '—',
      institutionName: report.institution?.name ?? '—',
      description: report.description,
      priority: report.priority ?? '—',
      location,
      coordinates: `${report.lat.toFixed(5)}, ${report.lng.toFixed(5)}`,
      createdAt: report.createdAt,
      approvedAt,
      dueAt: report.dueAt,
      status: STATUS_LABELS_SQ[report.status] ?? report.status,
      secureUrl,
      photoUrls: media.map((row) => row.url),
    });

    return { buffer, filename: `${report.publicId}.pdf` };
  }

  private async render(input: {
    publicId: string;
    categoryName: string;
    departmentName: string;
    institutionName: string;
    description: string;
    priority: string;
    location: string;
    coordinates: string;
    createdAt: Date;
    approvedAt: Date | null;
    dueAt: Date | null;
    status: string;
    secureUrl: string | null;
    photoUrls: string[];
  }): Promise<Buffer> {
    const images = await Promise.all(
      input.photoUrls.slice(0, 6).map((url) => this.fetchJpegOrPng(url)),
    );

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50, compress: false });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fillColor('#335f9b').fontSize(11).text('PRIZREN SMART CITY', { characterSpacing: 2 });
      doc.moveDown(0.3);
      doc.fillColor('#27211c').fontSize(20).text('Raport zyrtar i rastit');
      doc.moveDown(0.8);
      doc.fontSize(11).fillColor('#4a3f33');
      this.line(doc, 'Kodi publik', input.publicId);
      this.line(doc, 'Statusi', input.status);
      this.line(doc, 'Kategoria', input.categoryName);
      this.line(doc, 'Prioriteti', input.priority);
      this.line(doc, 'Departamenti', input.departmentName);
      this.line(doc, 'Institucioni', input.institutionName);
      this.line(doc, 'Lokacioni', input.location);
      this.line(doc, 'Koordinatat', input.coordinates);
      this.line(doc, 'Krijuar', input.createdAt.toISOString());
      this.line(doc, 'Miratuar', input.approvedAt ? input.approvedAt.toISOString() : '—');
      this.line(doc, 'Afati SLA', input.dueAt ? input.dueAt.toISOString() : '—');
      doc.moveDown(0.6);
      doc.fillColor('#27211c').fontSize(12).text('Përshkrimi');
      doc.moveDown(0.2);
      doc
        .fillColor('#4a3f33')
        .fontSize(11)
        .text(input.description.slice(0, 2000), { align: 'left' });
      doc.moveDown(0.8);
      if (input.secureUrl) {
        doc.fillColor('#27211c').fontSize(12).text('Lidhja e sigurt e institucionit');
        doc.moveDown(0.2);
        doc.fillColor('#335f9b').fontSize(10).text(input.secureUrl, { link: input.secureUrl });
      } else {
        doc
          .fillColor('#4a3f33')
          .fontSize(10)
          .text(
            'Lidhja e sigurt dërgohet me email institucional pas miratimit. Ky PDF nuk përmban të dhëna personale të qytetarit.',
          );
      }
      doc.moveDown(0.4);
      doc
        .fillColor('#7d6a55')
        .fontSize(9)
        .text(
          'Mos përfshini emrin, email-in ose telefonin e qytetarit. Dokumenti është për stafin e institucionit përgjegjës.',
        );

      for (const image of images) {
        if (!image) continue;
        doc.addPage();
        try {
          doc.image(image, { fit: [495, 680], align: 'center', valign: 'center' });
        } catch {
          doc.fontSize(10).fillColor('#4a3f33').text('Fotoja nuk u vendos në PDF.');
        }
      }

      doc.end();
    });
  }

  private line(doc: InstanceType<typeof PDFDocument>, label: string, value: string) {
    doc.fontSize(10).fillColor('#7d6a55').text(`${label}: `, { continued: true });
    doc.fillColor('#27211c').text(value);
  }

  private async fetchJpegOrPng(url: string): Promise<Buffer | null> {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8_000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) return null;
      const mime = res.headers.get('content-type') ?? '';
      if (!mime.includes('jpeg') && !mime.includes('jpg') && !mime.includes('png')) {
        return null;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 4 * 1024 * 1024) return null;
      return buf;
    } catch {
      return null;
    }
  }
}
