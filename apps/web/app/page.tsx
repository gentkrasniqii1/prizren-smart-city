import { getTranslations } from 'next-intl/server';
import type { PaginatedReports, TransparencyStats } from '@prizren/shared-types';
import { HomeFinalCta } from '@/components/home/home-final-cta';
import { HomeHeritage } from '@/components/home/home-heritage';
import { HomeHero } from '@/components/home/home-hero';
import { HomeHowItWorks } from '@/components/home/home-how-it-works';
import { HomeLiveIssues } from '@/components/home/home-live-issues';
import { HomeTransparency } from '@/components/home/home-transparency';
import { HomeTrust } from '@/components/home/home-trust';
import { fetchPublicJson } from '@/lib/public-api';

export async function generateMetadata() {
  const t = await getTranslations('Home');
  return {
    title: 'Prizren Smart City',
    description: t('subtitle'),
  };
}

export default async function Home() {
  const [stats, reportsPage] = await Promise.all([
    fetchPublicJson<TransparencyStats>('/transparency'),
    fetchPublicJson<PaginatedReports>('/reports?limit=3'),
  ]);

  const reports = reportsPage?.data ?? [];

  return (
    <main>
      <HomeHero />
      <HomeTrust stats={stats} />
      <HomeHeritage />
      <HomeHowItWorks />
      <HomeLiveIssues reports={reports} />
      <HomeTransparency stats={stats} />
      <HomeFinalCta />
    </main>
  );
}
