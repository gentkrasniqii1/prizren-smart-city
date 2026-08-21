'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Logo } from '@/components/brand/Logo';

const SLOW_AFTER_MS = 4000;

/** Shown while auth requests wait on a sleeping Render instance. */
export function ConnectingHint({ active }: { active: boolean }) {
  const t = useTranslations('Auth');
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!active) {
      setSlow(false);
      return;
    }
    const id = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => window.clearTimeout(id);
  }, [active]);

  if (!active) return null;

  return (
    <div
      className="flex items-start gap-3 rounded-md border border-border bg-muted/60 px-3 py-2.5"
      role="status"
      aria-live="polite"
    >
      <Logo variant="icon" size={28} className="mt-0.5 shrink-0" />
      <p className="flex min-w-0 items-start gap-2 text-sm text-foreground">
        <Loader2
          className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-muted-foreground"
          aria-hidden
        />
        <span>{slow ? t('connectingSlow') : t('connecting')}</span>
      </p>
    </div>
  );
}
