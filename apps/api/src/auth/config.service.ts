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
}
