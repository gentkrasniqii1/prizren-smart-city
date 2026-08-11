'use client';

import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

export function LanguageSwitcher() {
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
      className="inline-flex items-center rounded-md border border-stone-300 bg-white p-0.5 text-xs font-semibold"
      role="group"
      aria-label="Language"
    >
      <button
        type="button"
        disabled={pending || locale === 'sq'}
        onClick={() => setLocale('sq')}
        className={`min-h-10 min-w-10 rounded px-2.5 py-2 ${locale === 'sq' ? 'bg-mosque-700 text-white' : 'text-stone-600 hover:bg-stone-50'}`}
      >
        SQ
      </button>
      <button
        type="button"
        disabled={pending || locale === 'en'}
        onClick={() => setLocale('en')}
        className={`min-h-10 min-w-10 rounded px-2.5 py-2 ${locale === 'en' ? 'bg-mosque-700 text-white' : 'text-stone-600 hover:bg-stone-50'}`}
      >
        EN
      </button>
    </div>
  );
}
