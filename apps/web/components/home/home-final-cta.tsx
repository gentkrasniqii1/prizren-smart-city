import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/layout/page-container';
import { Section } from '@/components/home/section';
import { Reveal } from '@/components/motion/reveal';

export async function HomeFinalCta() {
  const t = await getTranslations('Home');

  return (
    <Section className="relative overflow-hidden py-0">
      <div className="relative min-h-[22rem] sm:min-h-[26rem]">
        <Image
          src="/images/prizren/kalaja.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-overlay-surface/90 via-overlay-surface/65 to-overlay-surface/35"
          aria-hidden
        />
        <PageContainer className="relative flex min-h-[22rem] flex-col items-start justify-end pb-14 pt-20 sm:min-h-[26rem] sm:pb-16">
          <Reveal>
            <h2 className="max-w-2xl font-display text-3xl font-semibold tracking-tight text-overlay-foreground sm:text-4xl">
              {t('final.title')}
            </h2>
            <p className="mt-3 max-w-xl text-base text-overlay-muted sm:text-lg">
              {t('final.body')}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/report">
                <Button size="lg" className="w-full sm:w-auto">
                  {t('ctaReport')}
                </Button>
              </Link>
              <Link href="/reports">
                <Button
                  size="lg"
                  variant="secondary"
                  className="w-full border-white/35 bg-white/95 text-chip-foreground sm:w-auto"
                >
                  {t('ctaBrowse')}
                </Button>
              </Link>
            </div>
          </Reveal>
        </PageContainer>
      </div>
    </Section>
  );
}
