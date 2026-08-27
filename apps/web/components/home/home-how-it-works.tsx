import Image from 'next/image';
import { Bot, Building2, ClipboardPen, Route } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { PageContainer } from '@/components/layout/page-container';
import { Section, SectionHeading } from '@/components/home/section';

const STEP_ICONS = [ClipboardPen, Bot, Building2, Route] as const;

export async function HomeHowItWorks() {
  const t = await getTranslations('Home');

  const steps = [
    { title: t('how.step1Title'), body: t('how.step1Body') },
    { title: t('how.step2Title'), body: t('how.step2Body') },
    { title: t('how.step3Title'), body: t('how.step3Body') },
    { title: t('how.step4Title'), body: t('how.step4Body') },
  ];

  return (
    <Section id="how-it-works" className="relative scroll-mt-20 overflow-hidden py-0">
      <div className="relative">
        <Image
          src="/images/prizren/overview.jpg"
          alt=""
          fill
          sizes="100vw"
          quality={75}
          className="object-cover"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-overlay-surface/90 via-overlay-surface/65 to-overlay-surface/35"
          aria-hidden
        />
        <PageContainer className="relative py-14 sm:py-20">
          <SectionHeading
            eyebrow={t('how.eyebrow')}
            title={t('how.title')}
            description={t('how.description')}
            tone="dark"
          />

          <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => {
              const Icon = STEP_ICONS[index]!;
              return (
                <li key={step.title} className="relative">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                      {index + 1}
                    </span>
                    <Icon className="h-5 w-5 text-gilt" aria-hidden />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-overlay-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-overlay-muted">{step.body}</p>
                </li>
              );
            })}
          </ol>
        </PageContainer>
      </div>
    </Section>
  );
}
