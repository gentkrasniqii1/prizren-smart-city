import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MailModule } from '../mail/mail.module';
import { AuditModule } from '../audit/audit.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ConfigService } from './config.service';
import { OauthService } from './oauth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { CsrfOriginGuard } from './guards/csrf-origin.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
    MailModule,
    AuditModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, OauthService, ConfigService, CsrfOriginGuard],
  exports: [AuthService, ConfigService],
})
export class AuthModule {}
