'use client';

import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

export function StepIndicator({
  steps,
  current,
}: {
  steps: { id: string; label: string }[];
  current: number;
}) {
  const t = useTranslations('ReportFlow');
  return (
    <div>
      {/* Mobile: compact number rail + current label */}
      <ol
        className="flex items-center justify-between gap-1 sm:hidden"
        aria-label={t('progressLabel')}
      >
        {steps.map((step, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <li key={step.id} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span
                className={cn(
                  'inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition duration-normal ease-product',
                  done && 'bg-mosque-700 text-white',
                  active && 'bg-mosque-700 text-white ring-4 ring-mosque-100',
                  !done && !active && 'bg-stone-200 text-stone-600',
                )}
                aria-current={active ? 'step' : undefined}
                aria-label={step.label}
              >
                {done ? <Check className="h-4 w-4" aria-hidden /> : index + 1}
              </span>
              {active ? (
                <span className="max-w-full truncate text-center text-[11px] font-medium text-stone-900">
                  {step.label}
                </span>
              ) : (
                <span className="sr-only">{step.label}</span>
              )}
            </li>
          );
        })}
      </ol>

      {/* sm+: full labels in a row */}
      <ol
        className="hidden sm:flex sm:flex-row sm:items-center sm:gap-0"
        aria-label={t('progressLabel')}
      >
        {steps.map((step, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <li key={step.id} className="flex items-center sm:flex-1">
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition duration-normal ease-product',
                    done && 'bg-mosque-700 text-white',
                    active && 'bg-mosque-700 text-white ring-4 ring-mosque-100',
                    !done && !active && 'bg-stone-200 text-stone-600',
                  )}
                  aria-current={active ? 'step' : undefined}
                >
                  {done ? <Check className="h-4 w-4" aria-hidden /> : index + 1}
                </span>
                <span
                  className={cn(
                    'text-sm font-medium',
                    active || done ? 'text-stone-900' : 'text-stone-500',
                  )}
                >
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 ? (
                <div
                  className={cn(
                    'mx-3 h-px flex-1 transition-colors duration-normal ease-product',
                    done ? 'bg-mosque-400' : 'bg-stone-200',
                  )}
                  aria-hidden
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
