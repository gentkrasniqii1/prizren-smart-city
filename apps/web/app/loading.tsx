import { getTranslations } from 'next-intl/server';
import { PageContainer } from '@/components/layout/page-container';
import { Spinner } from '@/components/ui/spinner';

export default async function Loading() {
  const t = await getTranslations('Common');
  return (
    <div className="py-16" role="status" aria-live="polite">
      <PageContainer>
        <Spinner label={t('loading')} />
      </PageContainer>
    </div>
  );
}
