import { getTranslations } from 'next-intl/server';
import { NotificationsPageSkeleton } from '@/components/ui/skeletons';

export default async function Loading() {
  const t = await getTranslations('Common');
  return <NotificationsPageSkeleton label={t('loading')} />;
}
