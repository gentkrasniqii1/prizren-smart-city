import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/layout/page-container';

export async function HomeHero() {
  const t = await getTranslations('Home');

  return (
    <section className="relative min-h-[min(92svh,52rem)] overflow-hidden">
      <Image
        src="/images/prizren/overview.jpg"
        alt={t('heroAlt')}
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      <div
        className="absolute inset-0 bg-gradient-to-r from-stone-950/85 via-stone-950/60 to-mosque-950/40"
        aria-hidden
      />
      <PageContainer className="relative flex min-h-[min(92svh,52rem)] flex-col justify-end pb-20 pt-28 sm:justify-center sm:pb-24">
        <p className="motion-fade-up text-xs font-semibold uppercase tracking-[0.22em] text-river-200 sm:text-sm">
          {t('eyebrow')}
        </p>
        <h1 className="motion-fade-up motion-delay-1 mt-4 max-w-3xl font-display text-4xl font-semibold tracking-tight text-stone-50 sm:text-5xl md:text-6xl">
          {t('title')}
        </h1>
        <p className="motion-fade-up motion-delay-2 mt-4 max-w-xl text-base text-stone-200 sm:text-lg">
          {t('subtitle')}
        </p>
        <div className="motion-fade-up motion-delay-3 mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link href="/report">
            <Button size="lg" className="w-full sm:w-auto">
              {t('ctaReport')}
            </Button>
          </Link>
          <Link href="/reports">
            <Button
              size="lg"
              variant="secondary"
              className="w-full border-white/35 bg-white/95 sm:w-auto"
            >
              {t('ctaBrowse')}
            </Button>
          </Link>
        </div>
      </PageContainer>
    </section>
  );
}
