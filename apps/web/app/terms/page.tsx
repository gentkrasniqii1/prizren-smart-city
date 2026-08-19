import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { LegalDocument, LegalPlaceholder, LegalSection } from '@/components/legal/legal-document';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Legal');
  return { title: t('termsTitle') };
}

export default async function TermsPage() {
  const t = await getTranslations('Legal');
  const review = t('reviewLabel');

  const toc = [
    { id: 'use', label: t('terms.useTitle') },
    { id: 'reporting', label: t('terms.reportingTitle') },
    { id: 'prohibited', label: t('terms.prohibitedTitle') },
    { id: 'false', label: t('terms.falseTitle') },
    { id: 'abuse', label: t('terms.abuseTitle') },
    { id: 'account', label: t('terms.accountTitle') },
    { id: 'public', label: t('terms.publicTitle') },
    { id: 'moderation', label: t('terms.moderationTitle') },
    { id: 'availability', label: t('terms.availabilityTitle') },
    { id: 'termination', label: t('terms.terminationTitle'), review: true },
    { id: 'liability', label: t('terms.liabilityTitle'), review: true },
    { id: 'contact', label: t('terms.contactTitle'), review: true },
  ];

  return (
    <LegalDocument
      kicker={t('kicker')}
      title={t('termsTitle')}
      updated={t('updated')}
      disclaimer={t('disclaimer')}
      reviewLabel={review}
      reviewShort={t('reviewShort')}
      contentsLabel={t('contents')}
      related={{ href: '/privacy', label: t('relatedPrivacy') }}
      toc={toc}
    >
      <LegalSection id="use" index={1} title={t('terms.useTitle')}>
        <p>{t('terms.useBody')}</p>
      </LegalSection>
      <LegalSection id="reporting" index={2} title={t('terms.reportingTitle')}>
        <p>{t('terms.reportingBody')}</p>
      </LegalSection>
      <LegalSection id="prohibited" index={3} title={t('terms.prohibitedTitle')}>
        <p>{t('terms.prohibitedBody')}</p>
      </LegalSection>
      <LegalSection id="false" index={4} title={t('terms.falseTitle')}>
        <p>{t('terms.falseBody')}</p>
      </LegalSection>
      <LegalSection id="abuse" index={5} title={t('terms.abuseTitle')}>
        <p>{t('terms.abuseBody')}</p>
      </LegalSection>
      <LegalSection id="account" index={6} title={t('terms.accountTitle')}>
        <p>{t('terms.accountBody')}</p>
      </LegalSection>
      <LegalSection id="public" index={7} title={t('terms.publicTitle')}>
        <p>{t('terms.publicBody')}</p>
      </LegalSection>
      <LegalSection id="moderation" index={8} title={t('terms.moderationTitle')}>
        <p>{t('terms.moderationBody')}</p>
      </LegalSection>
      <LegalSection id="availability" index={9} title={t('terms.availabilityTitle')}>
        <p>{t('terms.availabilityBody')}</p>
      </LegalSection>
      <LegalSection
        id="termination"
        index={10}
        title={t('terms.terminationTitle')}
        review
        reviewLabel={review}
      >
        <p>{t('terms.terminationBody')}</p>
        <LegalPlaceholder>{t('terms.terminationPlaceholder')}</LegalPlaceholder>
      </LegalSection>
      <LegalSection
        id="liability"
        index={11}
        title={t('terms.liabilityTitle')}
        review
        reviewLabel={review}
      >
        <p>{t('terms.liabilityBody')}</p>
        <LegalPlaceholder>{t('terms.liabilityPlaceholder')}</LegalPlaceholder>
      </LegalSection>
      <LegalSection
        id="contact"
        index={12}
        title={t('terms.contactTitle')}
        review
        reviewLabel={review}
      >
        <p>{t('terms.contactBody')}</p>
        <LegalPlaceholder>{t('terms.contactPlaceholder')}</LegalPlaceholder>
      </LegalSection>
    </LegalDocument>
  );
}
