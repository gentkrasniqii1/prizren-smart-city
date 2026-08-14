import { Module } from '@nestjs/common';
import { ConfigService } from '../auth/config.service';
import { MailService } from './mail.service';

@Module({
  providers: [MailService, ConfigService],
  exports: [MailService],
})
export class MailModule {}
