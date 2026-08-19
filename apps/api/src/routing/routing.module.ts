import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { RoutingService } from './routing.service';
import { RoutingRulesService } from './routing-rules.service';
import { RoutingController } from './routing.controller';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [RoutingController],
  providers: [RoutingService, RoutingRulesService],
  exports: [RoutingService],
})
export class RoutingModule {}
