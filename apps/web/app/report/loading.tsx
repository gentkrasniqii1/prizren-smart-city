import { getTranslations } from 'next-intl/server';
import { ReportFormSkeleton } from '@/components/ui/skeletons';

export default async function Loading() {
  const t = await getTranslations('Common');
  return <ReportFormSkeleton label={t('loading')} />;
}
