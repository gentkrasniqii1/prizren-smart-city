import { getTranslations } from 'next-intl/server';
import { DashboardSkeleton } from '@/components/ui/skeletons';

export default async function Loading() {
  const t = await getTranslations('Routing');
  return <DashboardSkeleton label={t('loading')} />;
}
