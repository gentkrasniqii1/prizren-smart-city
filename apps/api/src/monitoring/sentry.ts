import * as Sentry from '@sentry/node';

let initialized = false;

/** Initialize Sentry when SENTRY_DSN is set (no-op otherwise). */
export function initSentry(): void {
  if (initialized) return;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
  });
  initialized = true;
}

export { Sentry };
