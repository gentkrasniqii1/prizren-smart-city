import { Injectable } from '@nestjs/common';

@Injectable()
export class ConfigService {
  get jwtAccessSecret(): string {
    return process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me';
  }

  get jwtAccessExpiresIn(): string {
    return process.env.JWT_ACCESS_EXPIRES_IN ?? '15m';
  }

  get refreshCookieName(): string {
    return process.env.REFRESH_COOKIE_NAME ?? 'refresh_token';
  }

  get refreshExpiresDays(): number {
    return Number(process.env.JWT_REFRESH_EXPIRES_DAYS ?? 7);
  }

  get rememberMeExpiresDays(): number {
    return Number(process.env.JWT_REMEMBER_EXPIRES_DAYS ?? 30);
  }

  get encryptionKey(): string {
    return process.env.AUTH_ENCRYPTION_KEY ?? this.jwtAccessSecret;
  }

  get isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  get corsOrigin(): string {
    return process.env.CORS_ORIGIN ?? 'http://localhost:3000';
  }

  get webOrigin(): string {
    return (
      process.env.WEB_ORIGIN ?? this.corsOrigin.split(',')[0]?.trim() ?? 'http://localhost:3000'
    );
  }

  get googleClientId(): string {
    return process.env.GOOGLE_CLIENT_ID ?? '';
  }

  get googleClientSecret(): string {
    return process.env.GOOGLE_CLIENT_SECRET ?? '';
  }

  get googleCallbackUrl(): string {
    return process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:3001/auth/google/callback';
  }

  get googleAuthEnabled(): boolean {
    return Boolean(this.googleClientId && this.googleClientSecret);
  }

  get appleClientId(): string {
    return process.env.APPLE_CLIENT_ID ?? '';
  }

  get appleTeamId(): string {
    return process.env.APPLE_TEAM_ID ?? '';
  }

  get appleKeyId(): string {
    return process.env.APPLE_KEY_ID ?? '';
  }

  get applePrivateKey(): string {
    return (process.env.APPLE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');
  }

  get appleCallbackUrl(): string {
    return process.env.APPLE_CALLBACK_URL ?? 'http://localhost:3001/auth/apple/callback';
  }

  get appleAuthEnabled(): boolean {
    return Boolean(
      this.appleClientId && this.appleTeamId && this.appleKeyId && this.applePrivateKey,
    );
  }

  get facebookAppId(): string {
    return process.env.FACEBOOK_APP_ID ?? '';
  }

  get facebookAppSecret(): string {
    return process.env.FACEBOOK_APP_SECRET ?? '';
  }

  get facebookCallbackUrl(): string {
    return process.env.FACEBOOK_CALLBACK_URL ?? 'http://localhost:3001/auth/facebook/callback';
  }

  get facebookAuthEnabled(): boolean {
    return Boolean(this.facebookAppId && this.facebookAppSecret);
  }

  get resendApiKey(): string {
    return process.env.RESEND_API_KEY ?? '';
  }

  get smtpHost(): string {
    return process.env.SMTP_HOST ?? '';
  }

  get smtpPort(): number {
    return Number(process.env.SMTP_PORT ?? 587);
  }

  get smtpSecure(): boolean {
    return process.env.SMTP_SECURE === 'true';
  }

  get smtpUser(): string {
    return process.env.SMTP_USER ?? '';
  }

  get smtpPass(): string {
    return process.env.SMTP_PASS ?? '';
  }

  get mailFrom(): string {
    const name = process.env.MAIL_FROM_NAME ?? 'Prizren Smart City';
    // Resend's shared sender until a custom domain is verified.
    const email = process.env.MAIL_FROM ?? 'onboarding@resend.dev';
    return `${name} <${email}>`;
  }

  get requireAdmin2fa(): boolean {
    return process.env.REQUIRE_ADMIN_2FA === 'true';
  }

  get oauthStateCookieName(): string {
    return 'oauth_state';
  }
}
