import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { UploadsModule } from '../uploads/uploads.module';
import { AiModule } from '../ai/ai.module';
import { RoutingModule } from '../routing/routing.module';
import { InstitutionAccessModule } from '../institution-access/institution-access.module';
import { AuditModule } from '../audit/audit.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportPdfService } from './report-pdf.service';

@Module({
  imports: [
    AuthModule,
    MailModule,
    UploadsModule,
    AiModule,
    RoutingModule,
    InstitutionAccessModule,
    AuditModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService, ReportPdfService],
  exports: [ReportsService],
})
export class ReportsModule {}
