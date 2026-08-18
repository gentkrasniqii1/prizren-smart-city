'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import * as Sentry from '@sentry/react';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { PageContainer } from '@/components/layout/page-container';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('Common');

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="py-16">
      <PageContainer width="narrow">
        <ErrorState
          title={t('errorTitle')}
          description={t('errorHint')}
          onRetry={reset}
          action={
            <Link href="/">
              <Button variant="secondary">{t('backHome')}</Button>
            </Link>
          }
        />
      </PageContainer>
    </main>
  );
}
