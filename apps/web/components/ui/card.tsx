import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Card({
  children,
  className,
  interactive = false,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode; interactive?: boolean }) {
  return (
    <div
      className={cn('surface-card', interactive && 'surface-card-interactive', className)}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  className,
}: {
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn('border-b border-border px-inset py-gutter', className)}>
      <h2 className="ds-card-title">{title}</h2>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('px-inset py-gutter', className)}>{children}</div>;
}
