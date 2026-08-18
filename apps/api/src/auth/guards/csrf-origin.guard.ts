import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import {
  isTrustedMutationOrigin,
  parseAllowedOrigins,
  requestOrigin,
} from '../../common/csrf-origin';
import { ConfigService } from '../config.service';

/**
 * Extra CSRF check for endpoints that authenticate with cookies (refresh/logout).
 * SameSite=Lax already blocks most browser CSRF; this rejects forged Origins too.
 */
@Injectable()
export class CsrfOriginGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const origin = requestOrigin(req);
    const allowed = parseAllowedOrigins(this.config.corsOrigin, this.config.webOrigin);
    if (!isTrustedMutationOrigin(origin, allowed, this.config.isProduction)) {
      throw new ForbiddenException('Invalid request origin');
    }
    return true;
  }
}
