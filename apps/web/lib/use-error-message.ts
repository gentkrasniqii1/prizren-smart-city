'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { classifyUserError } from '@/lib/user-error';

const COMMON_KEYS = new Set([
  'networkError',
  'errorGeneric',
  'sessionExpired',
  'forbidden',
  'notFound',
  'rateLimited',
]);

/**
 * Maps thrown errors to copy the user can act on.
 * Network failures always win over page-specific fallbacks.
 */
export function useErrorMessage() {
  const t = useTranslations('Common');
  const tAuth = useTranslations('Auth');

  return useCallback(
    (err: unknown, fallback?: string) => {
      const classified = classifyUserError(err);
      if (classified.kind === 'network') return t('networkError');
      if (classified.kind === 'session') return t('sessionExpired');
      if (classified.kind === 'forbidden') return t('forbidden');
      if (classified.kind === 'notFound') return t('notFound');
      if (classified.kind === 'rateLimit') return t('rateLimited');
      if (classified.kind === 'mapped' && classified.mapKey) {
        if (classified.mapKey === 'errorGeneric') return fallback ?? t('errorGeneric');
        if (COMMON_KEYS.has(classified.mapKey)) {
          return t(classified.mapKey);
        }
        return tAuth(classified.mapKey);
      }
      if (classified.message) return classified.message;
      return fallback ?? t('errorGeneric');
    },
    [t, tAuth],
  );
}
