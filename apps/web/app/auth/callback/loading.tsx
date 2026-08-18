import { getTranslations } from 'next-intl/server';
import { AuthSessionSkeleton } from '@/components/ui/skeletons';

export default async function Loading() {
  const t = await getTranslations('Auth');
  return <AuthSessionSkeleton label={t('completingSignIn')} />;
}
