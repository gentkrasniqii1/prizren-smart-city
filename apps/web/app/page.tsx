import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';

export async function generateMetadata() {
  const t = await getTranslations('Home');
  return {
    title: 'Prizren Smart City',
    description: t('subtitle'),
  };
}

export default async function Home() {
  const t = await getTranslations('Home');

  return (
    <main className="relative min-h-[calc(100vh-4.5rem)] overflow-hidden">
      <Image
        src="/images/prizren/overview.jpg"
        alt={t('heroAlt')}
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-stone-950/80 via-stone-950/55 to-mosque-950/35" />
      <div className="relative mx-auto flex min-h-[calc(100vh-4.5rem)] max-w-6xl flex-col justify-end px-4 pb-16 pt-24 sm:justify-center sm:pb-20">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-river-200 sm:text-sm">
          {t('eyebrow')}
        </p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold tracking-tight text-stone-50 sm:text-5xl md:text-6xl">
          {t('title')}
        </h1>
        <p className="mt-4 max-w-xl text-base text-stone-200 sm:text-lg">{t('subtitle')}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link href="/report">
            <Button size="lg" className="w-full sm:w-auto">
              {t('ctaReport')}
            </Button>
          </Link>
          <Link href="/reports">
            <Button
              size="lg"
              variant="secondary"
              className="w-full border-white/40 bg-white/90 sm:w-auto"
            >
              {t('ctaBrowse')}
            </Button>
          </Link>
          <Link href="/transparency">
            <Button
              size="lg"
              variant="ghost"
              className="w-full text-stone-50 hover:bg-white/10 sm:w-auto"
            >
              {t('ctaTransparency')}
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
