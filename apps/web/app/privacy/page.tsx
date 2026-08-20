import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { LegalDocument, LegalPlaceholder, LegalSection } from '@/components/legal/legal-document';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Legal');
  return { title: t('privacyTitle') };
}

export default async function PrivacyPage() {
  const t = await getTranslations('Legal');
  const review = t('reviewLabel');

  const toc = [
    { id: 'collection', label: t('privacy.collectTitle'), review: true },
    { id: 'reports', label: t('privacy.reportsTitle') },
    { id: 'account', label: t('privacy.accountTitle') },
    { id: 'location', label: t('privacy.locationTitle') },
    { id: 'images', label: t('privacy.imagesTitle') },
    { id: 'cookies', label: t('privacy.cookiesTitle'), review: true },
    { id: 'auth', label: t('privacy.authTitle'), review: true },
    { id: 'google', label: t('privacy.googleTitle'), review: true },
    { id: 'facebook', label: t('privacy.facebookTitle'), review: true },
    { id: 'retention', label: t('privacy.retentionTitle'), review: true },
    { id: 'rights', label: t('privacy.rightsTitle'), review: true },
    { id: 'deletion', label: t('privacy.deletionTitle'), review: true },
    { id: 'contact', label: t('privacy.contactTitle'), review: true },
  ];

  return (
    <LegalDocument
      kicker={t('kicker')}
      title={t('privacyTitle')}
      updated={t('updated')}
      disclaimer={t('disclaimer')}
      reviewLabel={review}
      reviewShort={t('reviewShort')}
      contentsLabel={t('contents')}
      related={{ href: '/terms', label: t('relatedTerms') }}
      toc={toc}
    >
      <LegalSection
        id="collection"
        index={1}
        title={t('privacy.collectTitle')}
        review
        reviewLabel={review}
      >
        <p>{t('privacy.collectBody')}</p>
      </LegalSection>
      <LegalSection id="reports" index={2} title={t('privacy.reportsTitle')}>
        <p>{t('privacy.reportsBody')}</p>
      </LegalSection>
      <LegalSection id="account" index={3} title={t('privacy.accountTitle')}>
        <p>{t('privacy.accountBody')}</p>
      </LegalSection>
      <LegalSection id="location" index={4} title={t('privacy.locationTitle')}>
        <p>{t('privacy.locationBody')}</p>
      </LegalSection>
      <LegalSection id="images" index={5} title={t('privacy.imagesTitle')}>
        <p>{t('privacy.imagesBody')}</p>
      </LegalSection>
      <LegalSection
        id="cookies"
        index={6}
        title={t('privacy.cookiesTitle')}
        review
        reviewLabel={review}
      >
        <p>{t('privacy.cookiesBody')}</p>
      </LegalSection>
      <LegalSection id="auth" index={7} title={t('privacy.authTitle')} review reviewLabel={review}>
        <p>{t('privacy.authBody')}</p>
      </LegalSection>
      <LegalSection
        id="google"
        index={8}
        title={t('privacy.googleTitle')}
        review
        reviewLabel={review}
      >
        <p>{t('privacy.googleBody')}</p>
      </LegalSection>
      <LegalSection
        id="facebook"
        index={9}
        title={t('privacy.facebookTitle')}
        review
        reviewLabel={review}
      >
        <p>{t('privacy.facebookBody')}</p>
      </LegalSection>
      <LegalSection
        id="retention"
        index={10}
        title={t('privacy.retentionTitle')}
        review
        reviewLabel={review}
      >
        <p>{t('privacy.retentionBody')}</p>
        <LegalPlaceholder>{t('privacy.retentionPlaceholder')}</LegalPlaceholder>
      </LegalSection>
      <LegalSection
        id="rights"
        index={11}
        title={t('privacy.rightsTitle')}
        review
        reviewLabel={review}
      >
        <p>{t('privacy.rightsBody')}</p>
        <LegalPlaceholder>{t('privacy.rightsPlaceholder')}</LegalPlaceholder>
      </LegalSection>
      <LegalSection
        id="deletion"
        index={12}
        title={t('privacy.deletionTitle')}
        review
        reviewLabel={review}
      >
        <p>{t('privacy.deletionBody')}</p>
        <LegalPlaceholder>{t('privacy.deletionPlaceholder')}</LegalPlaceholder>
      </LegalSection>
      <LegalSection
        id="contact"
        index={13}
        title={t('privacy.contactTitle')}
        review
        reviewLabel={review}
      >
        <p>{t('privacy.contactBody')}</p>
        <LegalPlaceholder>{t('privacy.contactPlaceholder')}</LegalPlaceholder>
      </LegalSection>
    </LegalDocument>
  );
}
