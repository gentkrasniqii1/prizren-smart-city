import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { MailModule } from '../mail/mail.module';
import { OutboundEmailController } from './outbound-email.controller';
import { OutboundEmailService } from './outbound-email.service';

@Module({
  imports: [AuthModule, AuditModule, MailModule],
  controllers: [OutboundEmailController],
  providers: [OutboundEmailService],
  exports: [OutboundEmailService],
})
export class OutboundEmailModule {}
