import { Camera, MapPinned, ShieldCheck, Sparkles } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { TransparencyStats } from '@prizren/shared-types';
import { PageContainer } from '@/components/layout/page-container';
import { Section } from '@/components/home/section';
import { Reveal } from '@/components/motion/reveal';

const ICONS = [ShieldCheck, MapPinned, Sparkles, Camera] as const;

export async function HomeTrust({ stats }: { stats: TransparencyStats | null }) {
  const t = await getTranslations('Home');

  const items = [
    {
      label: t('trust.transparent'),
      value:
        stats && stats.total > 0
          ? t('trust.openCount', { count: stats.pendingOpen })
          : t('trust.transparentHint'),
    },
    {
      label: t('trust.response'),
      value:
        stats?.avgResolutionHours != null
          ? t('trust.avgHours', { hours: stats.avgResolutionHours })
          : t('trust.responseHint'),
    },
    {
      label: t('trust.realtime'),
      value:
        stats && stats.total > 0
          ? t('trust.resolvedCount', { count: stats.resolved })
          : t('trust.realtimeHint'),
    },
    {
      label: t('trust.civic'),
      value:
        stats && stats.total > 0
          ? t('trust.totalCount', { count: stats.total })
          : t('trust.civicHint'),
    },
  ];

  return (
    <Section className="border-b border-stone-200 bg-card py-10 sm:py-12">
      <PageContainer>
        <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item, i) => {
            const Icon = ICONS[i]!;
            const delay = Math.min(i, 4) as 0 | 1 | 2 | 3 | 4;
            return (
              <Reveal key={item.label} as="li" delay={delay} className="flex gap-3">
                <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-mosque-50 text-mosque-800">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold text-stone-900">{item.label}</p>
                  <p className="mt-1 text-sm text-stone-600">{item.value}</p>
                </div>
              </Reveal>
            );
          })}
        </ul>
      </PageContainer>
    </Section>
  );
}
