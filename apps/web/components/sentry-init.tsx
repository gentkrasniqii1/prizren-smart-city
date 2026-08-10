'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/react';

let started = false;

/** Client-side Sentry (no-op unless NEXT_PUBLIC_SENTRY_DSN is set). */
export function SentryInit() {
  useEffect(() => {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn || started) return;
    Sentry.init({
      dsn,
      tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
      environment: process.env.NODE_ENV,
    });
    started = true;
  }, []);

  return null;
}
