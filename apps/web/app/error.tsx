'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
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
    console.error(error);
  }, [error]);

  return (
    <main className="py-16" role="alert">
      <PageContainer width="narrow" className="text-center">
        <h1 className="font-display text-2xl tracking-tight text-stone-950">{t('errorTitle')}</h1>
        <p className="mt-3 text-stone-600">{t('errorGeneric')}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button type="button" onClick={reset}>
            {t('retry')}
          </Button>
          <Link href="/">
            <Button variant="secondary">{t('backHome')}</Button>
          </Link>
        </div>
      </PageContainer>
    </main>
  );
}
