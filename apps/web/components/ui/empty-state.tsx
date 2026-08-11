import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  icon?: ReactNode;
};

export function EmptyState({ title, description, action, className, icon }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'rounded-md border border-dashed border-stone-300 bg-white px-4 py-10 text-center',
        className,
      )}
    >
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-stone-100 text-stone-500">
        {icon ?? <Inbox className="h-5 w-5" aria-hidden />}
      </div>
      <p className="text-base font-medium text-stone-900">{title}</p>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm text-stone-600">{description}</p>
      ) : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}
