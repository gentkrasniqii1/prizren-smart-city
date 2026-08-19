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
        className="absolute inset-0 bg-gradient-to-r from-overlay-surface/85 via-overlay-surface/60 to-overlay-surface/40"
        aria-hidden
      />
      <PageContainer className="relative flex min-h-[min(92svh,52rem)] flex-col justify-end pb-20 pt-28 sm:justify-center sm:pb-24">
        <p className="motion-fade-up ds-kicker sm:text-sm">{t('eyebrow')}</p>
        <h1 className="ds-display motion-fade-up motion-delay-1 mt-gutter max-w-3xl text-overlay-foreground sm:text-display-lg md:text-display-xl">
          {t('title')}
        </h1>
        <p className="motion-fade-up motion-delay-2 mt-4 max-w-xl text-base text-overlay-muted sm:text-lg">
          {t('subtitle')}
        </p>
        <div className="motion-fade-up motion-delay-3 mt-8 flex flex-col gap-cluster sm:flex-row sm:items-center">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/report">{t('ctaReport')}</Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="secondary"
            className="w-full border-white/35 bg-white/95 text-chip-foreground sm:w-auto"
          >
            <Link href="/reports">{t('ctaBrowse')}</Link>
          </Button>
        </div>
      </PageContainer>
    </section>
  );
}
