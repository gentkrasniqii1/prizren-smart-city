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
        <p className="text-caption font-semibold uppercase tracking-[0.18em] text-gilt">
          {eyebrow}
        </p>
      ) : null}
      <h2
        className={cn(
          'font-sans text-h2',
          dark ? 'text-overlay-foreground' : 'text-foreground',
          eyebrow && 'mt-2',
        )}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            'mt-3 text-base sm:text-lg',
            dark ? 'text-overlay-muted' : 'text-stone-600',
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
