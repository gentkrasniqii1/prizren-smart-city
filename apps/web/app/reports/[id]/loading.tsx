import { getTranslations } from 'next-intl/server';
import { ReportDetailSkeleton } from '@/components/ui/skeletons';

export default async function Loading() {
  const t = await getTranslations('Common');
  return <ReportDetailSkeleton label={t('loading')} />;
}
