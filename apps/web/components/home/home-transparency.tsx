import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { TransparencyStats } from '@prizren/shared-types';
import { PageContainer } from '@/components/layout/page-container';
import { Section, SectionHeading } from '@/components/home/section';
import { Reveal } from '@/components/motion/reveal';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';

export async function HomeTransparency({ stats }: { stats: TransparencyStats | null }) {
  const t = await getTranslations('Home');

  return (
    <Section className="bg-mosque-950 text-stone-50">
      <PageContainer>
        <Reveal>
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <SectionHeading
              tone="dark"
              eyebrow={t('transparency.eyebrow')}
              title={t('transparency.title')}
              description={t('transparency.description')}
            />
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <Link href="/transparency">
                <Button
                  size="lg"
                  variant="secondary"
                  className="border-white/20 bg-white text-stone-900"
                >
                  {t('transparency.cta')}
                </Button>
              </Link>
              <Link href="/reports">
                <Button size="lg" variant="ghost" className="text-stone-50 hover:bg-white/10">
                  {t('ctaBrowse')}
                </Button>
              </Link>
            </div>
          </div>
        </Reveal>

        <Reveal delay={1}>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard tone="dark" label={t('transparency.total')} value={stats?.total ?? '—'} />
            <StatCard
              tone="dark"
              label={t('transparency.open')}
              value={stats?.pendingOpen ?? '—'}
            />
            <StatCard
              tone="dark"
              label={t('transparency.resolved')}
              value={stats?.resolved ?? '—'}
            />
            <StatCard
              tone="dark"
              label={t('transparency.rate')}
              value={stats?.resolutionRate == null ? '—' : `${stats.resolutionRate}%`}
            />
          </div>
        </Reveal>
      </PageContainer>
    </Section>
  );
}
