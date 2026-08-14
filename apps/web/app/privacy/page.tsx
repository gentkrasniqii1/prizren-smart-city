import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { LegalDocument, LegalSection } from '@/components/legal/legal-document';

export const metadata: Metadata = {
  title: 'Politika e privatësisë',
};

export default async function PrivacyPage() {
  const t = await getTranslations('Legal');

  return (
    <LegalDocument title={t('privacyTitle')} updated={t('updated')} disclaimer={t('disclaimer')}>
      <LegalSection title={t('privacy.collectTitle')}>
        <p>{t('privacy.collectBody')}</p>
      </LegalSection>
      <LegalSection title={t('privacy.reportsTitle')}>
        <p>{t('privacy.reportsBody')}</p>
      </LegalSection>
      <LegalSection title={t('privacy.accountTitle')}>
        <p>{t('privacy.accountBody')}</p>
      </LegalSection>
      <LegalSection title={t('privacy.locationTitle')}>
        <p>{t('privacy.locationBody')}</p>
      </LegalSection>
      <LegalSection title={t('privacy.imagesTitle')}>
        <p>{t('privacy.imagesBody')}</p>
      </LegalSection>
      <LegalSection title={t('privacy.cookiesTitle')}>
        <p>{t('privacy.cookiesBody')}</p>
      </LegalSection>
      <LegalSection title={t('privacy.authTitle')}>
        <p>{t('privacy.authBody')}</p>
      </LegalSection>
      <LegalSection title={t('privacy.retentionTitle')}>
        <p>{t('privacy.retentionBody')}</p>
      </LegalSection>
      <LegalSection title={t('privacy.rightsTitle')}>
        <p>{t('privacy.rightsBody')}</p>
      </LegalSection>
      <LegalSection title={t('privacy.deletionTitle')}>
        <p>{t('privacy.deletionBody')}</p>
      </LegalSection>
      <LegalSection title={t('privacy.contactTitle')}>
        <p>{t('privacy.contactBody')}</p>
      </LegalSection>
    </LegalDocument>
  );
}
