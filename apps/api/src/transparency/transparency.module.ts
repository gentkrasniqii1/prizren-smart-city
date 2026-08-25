import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { DepartmentsModule } from '../departments/departments.module';
import { TransparencyController } from './transparency.controller';

@Module({
  imports: [AnalyticsModule, DepartmentsModule],
  controllers: [TransparencyController],
})
export class TransparencyModule {}
