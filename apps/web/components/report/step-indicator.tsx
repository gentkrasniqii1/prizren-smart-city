'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export function StepIndicator({
  steps,
  current,
}: {
  steps: { id: string; label: string }[];
  current: number;
}) {
  return (
    <ol className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-0" aria-label="Progress">
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={step.id} className="flex items-center sm:flex-1">
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
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
                  'mx-3 hidden h-px flex-1 sm:block',
                  done ? 'bg-mosque-400' : 'bg-stone-200',
                )}
                aria-hidden
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
