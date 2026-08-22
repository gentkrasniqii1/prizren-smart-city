import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { InstitutionAccessController } from './institution-access.controller';
import { InstitutionAccessService } from './institution-access.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [InstitutionAccessController],
  providers: [InstitutionAccessService],
  exports: [InstitutionAccessService],
})
export class InstitutionAccessModule {}
