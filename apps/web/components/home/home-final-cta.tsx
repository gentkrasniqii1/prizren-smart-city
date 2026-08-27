import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/layout/page-container';
import { Section } from '@/components/home/section';

export async function HomeFinalCta() {
  const t = await getTranslations('Home');

  return (
    <Section className="relative overflow-hidden py-0">
      <div className="relative min-h-[22rem] sm:min-h-[26rem]">
        <Image
          src="/images/prizren/fortress.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-overlay-surface/90 via-overlay-surface/65 to-overlay-surface/35"
          aria-hidden
        />
        <PageContainer className="relative flex min-h-[22rem] flex-col items-start justify-end pb-[calc(3.5rem+var(--bottom-nav-h))] pt-20 sm:min-h-[26rem] sm:pb-16">
          <h2 className="ds-display max-w-2xl text-overlay-foreground sm:text-display-lg">
            {t('final.title')}
          </h2>
          <p className="mt-cluster max-w-xl text-base text-overlay-muted sm:text-lg">
            {t('final.body')}
          </p>
          <div className="mt-8 flex flex-col gap-cluster sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/report">{t('ctaReport')}</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="w-full border-white/35 bg-white/95 text-chip-foreground hover:bg-white hover:text-chip-foreground active:bg-white active:text-chip-foreground sm:w-auto"
            >
              <Link href="/reports">{t('ctaBrowse')}</Link>
            </Button>
          </div>
        </PageContainer>
      </div>
    </Section>
  );
}
