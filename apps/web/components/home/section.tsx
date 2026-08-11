import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
  tone = 'light',
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: 'left' | 'center';
  tone?: 'light' | 'dark';
  className?: string;
}) {
  const dark = tone === 'dark';
  return (
    <div className={cn(align === 'center' && 'mx-auto max-w-2xl text-center', className)}>
      {eyebrow ? (
        <p
          className={cn(
            'text-caption font-semibold uppercase tracking-[0.18em]',
            dark ? 'text-river-300' : 'text-mosque-700',
          )}
        >
          {eyebrow}
        </p>
      ) : null}
      <h2
        className={cn(
          'font-display text-h2 tracking-tight sm:text-[1.75rem]',
          dark ? 'text-stone-50' : 'text-stone-950',
          eyebrow && 'mt-2',
        )}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            'mt-3 text-base sm:text-lg',
            dark ? 'text-mosque-100/90' : 'text-stone-600',
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function Section({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn('py-14 sm:py-20', className)}>
      {children}
    </section>
  );
}
