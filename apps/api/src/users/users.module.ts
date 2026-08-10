import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { UsersController } from './users.controller';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [UsersController],
})
export class UsersModule {}
