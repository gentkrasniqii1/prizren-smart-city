import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { LegalDocument, LegalSection } from '@/components/legal/legal-document';

export const metadata: Metadata = {
  title: 'Kushtet e përdorimit',
};

export default async function TermsPage() {
  const t = await getTranslations('Legal');

  return (
    <LegalDocument title={t('termsTitle')} updated={t('updated')} disclaimer={t('disclaimer')}>
      <LegalSection title={t('terms.useTitle')}>
        <p>{t('terms.useBody')}</p>
      </LegalSection>
      <LegalSection title={t('terms.reportingTitle')}>
        <p>{t('terms.reportingBody')}</p>
      </LegalSection>
      <LegalSection title={t('terms.prohibitedTitle')}>
        <p>{t('terms.prohibitedBody')}</p>
      </LegalSection>
      <LegalSection title={t('terms.falseTitle')}>
        <p>{t('terms.falseBody')}</p>
      </LegalSection>
      <LegalSection title={t('terms.abuseTitle')}>
        <p>{t('terms.abuseBody')}</p>
      </LegalSection>
      <LegalSection title={t('terms.accountTitle')}>
        <p>{t('terms.accountBody')}</p>
      </LegalSection>
      <LegalSection title={t('terms.publicTitle')}>
        <p>{t('terms.publicBody')}</p>
      </LegalSection>
      <LegalSection title={t('terms.moderationTitle')}>
        <p>{t('terms.moderationBody')}</p>
      </LegalSection>
      <LegalSection title={t('terms.availabilityTitle')}>
        <p>{t('terms.availabilityBody')}</p>
      </LegalSection>
      <LegalSection title={t('terms.terminationTitle')}>
        <p>{t('terms.terminationBody')}</p>
      </LegalSection>
      <LegalSection title={t('terms.liabilityTitle')}>
        <p>{t('terms.liabilityBody')}</p>
      </LegalSection>
      <LegalSection title={t('terms.contactTitle')}>
        <p>{t('terms.contactBody')}</p>
      </LegalSection>
    </LegalDocument>
  );
}
