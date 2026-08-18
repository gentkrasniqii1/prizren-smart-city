import { Request } from 'express';

export function parseAllowedOrigins(corsOrigin: string, webOrigin: string): string[] {
  const origins = corsOrigin
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (webOrigin && !origins.includes(webOrigin)) {
    origins.push(webOrigin);
  }
  return origins;
}

export function requestOrigin(req: Pick<Request, 'headers'>): string | null {
  const origin = req.headers.origin;
  if (typeof origin === 'string' && origin.length > 0) {
    return origin;
  }
  const referer = req.headers.referer;
  if (typeof referer === 'string' && referer.length > 0) {
    try {
      return new URL(referer).origin;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Cookie-authenticated POSTs must come from an allowlisted Origin.
 * Missing Origin is allowed only outside production (curl, health checks).
 */
export function isTrustedMutationOrigin(
  origin: string | null,
  allowed: string[],
  isProduction: boolean,
): boolean {
  if (!origin) {
    return !isProduction;
  }
  return allowed.includes(origin);
}
