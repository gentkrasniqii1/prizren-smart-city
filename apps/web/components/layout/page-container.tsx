import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Width = 'default' | 'narrow' | 'wide' | 'full';

const widths: Record<Width, string> = {
  default: 'max-w-6xl',
  narrow: 'max-w-2xl',
  wide: 'max-w-7xl',
  full: 'max-w-none',
};

/**
 * Shared horizontal page rhythm. Prefer this over ad-hoc max-w + px stacks.
 */
export function PageContainer({
  children,
  className,
  width = 'default',
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  width?: Width;
  as?: 'div' | 'section' | 'main';
}) {
  return <Tag className={cn('mx-auto w-full px-gutter', widths[width], className)}>{children}</Tag>;
}
