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

  get isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  get corsOrigin(): string {
    return process.env.CORS_ORIGIN ?? 'http://localhost:3000';
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

  get webOrigin(): string {
    return (
      process.env.WEB_ORIGIN ?? this.corsOrigin.split(',')[0]?.trim() ?? 'http://localhost:3000'
    );
  }
}
