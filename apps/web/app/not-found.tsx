import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';

export default async function NotFound() {
  const t = await getTranslations('NotFound');

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center px-4 py-16 text-center">
      <div className="relative mb-8 h-40 w-full max-w-md overflow-hidden rounded-xl shadow-soft">
        <Image
          src="/images/prizren/old-town.jpg"
          alt={t('imageAlt')}
          fill
          className="object-cover"
          sizes="28rem"
        />
        <div className="absolute inset-0 bg-overlay-surface/35" />
      </div>
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-mosque-700">404</p>
      <h1 className="mt-2 ds-page-title">{t('title')}</h1>
      <p className="mt-cluster max-w-md text-muted-foreground">{t('body')}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-cluster">
        <Button asChild>
          <Link href="/">{t('home')}</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/reports">{t('reports')}</Link>
        </Button>
      </div>
    </main>
  );
}
