'use client';

import { CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ErrorState({
  title,
  description,
  onRetry,
  action,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  action?: ReactNode;
  className?: string;
}) {
  const t = useTranslations('Common');

  return (
    <div
      role="alert"
      className={cn('rounded-xl border border-border bg-card px-5 py-10 text-center', className)}
    >
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <CircleAlert className="h-5 w-5" aria-hidden />
      </div>
      <p className="font-display text-lg tracking-tight text-foreground">
        {title ?? t('errorTitle')}
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {description ?? t('errorHint')}
      </p>
      {onRetry || action ? (
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {onRetry ? (
            <Button type="button" onClick={onRetry}>
              {t('retry')}
            </Button>
          ) : null}
          {action}
        </div>
      ) : null}
    </div>
  );
}
