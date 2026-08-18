import { getTranslations } from 'next-intl/server';
import { ReportsPageSkeleton } from '@/components/ui/skeletons';

export default async function Loading() {
  const t = await getTranslations('Common');
  return <ReportsPageSkeleton label={t('loading')} />;
}
