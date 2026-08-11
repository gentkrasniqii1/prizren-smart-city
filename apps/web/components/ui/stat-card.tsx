import { cn } from '@/lib/utils';

export function StatCard({
  label,
  value,
  hint,
  className,
  tone = 'light',
}: {
  label: string;
  value: string | number;
  hint?: string;
  className?: string;
  tone?: 'light' | 'dark';
}) {
  const dark = tone === 'dark';
  return (
    <div
      className={cn(
        'rounded-md border px-4 py-3',
        dark ? 'border-white/10 bg-white/5' : 'border-stone-200 bg-white',
        className,
      )}
    >
      <p
        className={cn(
          'text-caption uppercase tracking-wide',
          dark ? 'text-mosque-200' : 'text-stone-500',
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          'mt-1 text-2xl font-semibold tabular-nums',
          dark ? 'text-stone-50' : 'text-stone-900',
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className={cn('mt-1 text-xs', dark ? 'text-mosque-200/80' : 'text-stone-500')}>{hint}</p>
      ) : null}
    </div>
  );
}
