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

  /** Must be the string 'true'. Any other value (including unset) keeps institutional send off. */
  get institutionalMailEnabled(): boolean {
    return process.env.INSTITUTIONAL_MAIL_ENABLED === 'true';
  }

  /** Lifetime of hashed institution mail links. Clamped to 1–365 days; default 30. */
  get institutionAccessTtlDays(): number {
    const parsed = Number.parseInt(process.env.INSTITUTION_ACCESS_TTL_DAYS ?? '30', 10);
    if (!Number.isFinite(parsed) || parsed < 1) return 30;
    return Math.min(parsed, 365);
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

  get oauthLinkCookieName(): string {
    return 'oauth_link';
  }

  get oauthPendingCookieName(): string {
    return 'oauth_pending';
  }

  get trustedDeviceCookieName(): string {
    return process.env.TRUSTED_DEVICE_COOKIE_NAME ?? 'trusted_device';
  }

  get trustedDeviceDays(): number {
    return Number(process.env.TRUSTED_DEVICE_DAYS ?? 30);
  }
}
