import { getTranslations } from 'next-intl/server';
import { TransparencyPageSkeleton } from '@/components/ui/skeletons';

export default async function Loading() {
  const t = await getTranslations('Common');
  return <TransparencyPageSkeleton label={t('loading')} />;
}
