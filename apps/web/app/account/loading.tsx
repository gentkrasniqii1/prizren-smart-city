import { getTranslations } from 'next-intl/server';
import { AccountPageSkeleton } from '@/components/ui/skeletons';

export default async function Loading() {
  const t = await getTranslations('Common');
  return <AccountPageSkeleton label={t('loading')} />;
}
