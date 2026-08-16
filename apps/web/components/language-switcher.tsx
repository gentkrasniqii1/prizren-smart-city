'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

export function LanguageSwitcher() {
  const t = useTranslations('Common');
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function setLocale(next: 'sq' | 'en') {
    document.cookie = `NEXT_LOCALE=${next};path=/;max-age=31536000;samesite=lax`;
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div
      className="inline-flex items-center rounded-md border border-border bg-card p-0.5 text-xs font-semibold"
      role="group"
      aria-label={t('language')}
    >
      <button
        type="button"
        disabled={pending || locale === 'sq'}
        onClick={() => setLocale('sq')}
        aria-pressed={locale === 'sq'}
        lang="sq"
        className={`min-h-10 min-w-10 rounded px-2.5 py-2 ${locale === 'sq' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
      >
        SQ
      </button>
      <button
        type="button"
        disabled={pending || locale === 'en'}
        onClick={() => setLocale('en')}
        aria-pressed={locale === 'en'}
        lang="en"
        className={`min-h-10 min-w-10 rounded px-2.5 py-2 ${locale === 'en' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
      >
        EN
      </button>
    </div>
  );
}
