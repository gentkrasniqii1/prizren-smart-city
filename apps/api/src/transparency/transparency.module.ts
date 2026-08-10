import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { TransparencyController } from './transparency.controller';

@Module({
  imports: [AnalyticsModule],
  controllers: [TransparencyController],
})
export class TransparencyModule {}
