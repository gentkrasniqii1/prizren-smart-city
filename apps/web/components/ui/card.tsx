import type { HTMLAttributes, ReactNode } from 'react';

export function Card({
  children,
  className = '',
  ...rest
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      className={`rounded-xl border border-stone-200 bg-white shadow-soft ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="border-b border-stone-100 px-5 py-4">
      <h2 className="font-display text-xl font-semibold text-stone-950">{title}</h2>
      {description ? <p className="mt-1 text-sm text-stone-600">{description}</p> : null}
    </div>
  );
}
