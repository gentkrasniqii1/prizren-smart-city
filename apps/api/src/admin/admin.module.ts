import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminDataController } from './admin-data.controller';
import { AdminDataService } from './admin-data.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [AdminController, AdminDataController],
  providers: [AdminDataService],
})
export class AdminModule {}
