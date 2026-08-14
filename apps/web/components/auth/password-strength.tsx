'use client';

import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getPasswordChecks, passwordScore } from '@/lib/password';
import { cn } from '@/lib/utils';

export function PasswordStrength({ password }: { password: string }) {
  const t = useTranslations('Auth');
  const checks = getPasswordChecks(password);
  const score = passwordScore(password);
  const items = [
    { key: 'length', ok: checks.length, label: t('ruleLength') },
    { key: 'upper', ok: checks.upper, label: t('ruleUpper') },
    { key: 'lower', ok: checks.lower, label: t('ruleLower') },
    { key: 'number', ok: checks.number, label: t('ruleNumber') },
    { key: 'special', ok: checks.special, label: t('ruleSpecial') },
  ] as const;

  const bar = score <= 2 ? 'bg-destructive' : score <= 4 ? 'bg-amber-500' : 'bg-river-600';

  return (
    <div className="mt-3 space-y-2" aria-live="polite">
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all duration-normal', bar)}
          style={{ width: `${(score / 5) * 100}%` }}
        />
      </div>
      <ul className="grid gap-1 sm:grid-cols-2">
        {items.map((item) => (
          <li
            key={item.key}
            className={cn(
              'flex items-center gap-1.5 text-xs',
              item.ok ? 'text-river-700 dark:text-river-300' : 'text-muted-foreground',
            )}
          >
            <Check
              className={cn('h-3.5 w-3.5', item.ok ? 'opacity-100' : 'opacity-30')}
              aria-hidden
            />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
