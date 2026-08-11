import type {
  ReactNode,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/utils';

const fieldBase =
  'mt-1 w-full min-h-11 rounded-md border bg-card px-3 py-2.5 text-base text-foreground outline-none transition duration-fast ease-product placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground sm:min-h-10 sm:py-2 sm:text-sm';

const fieldOk =
  'border-input hover:border-stone-400 focus:border-primary focus:ring-2 focus:ring-mosque-200 dark:focus:ring-mosque-800';

const fieldErr =
  'border-destructive focus:border-destructive focus:ring-2 focus:ring-red-100 dark:focus:ring-red-950';

type FieldState = {
  invalid?: boolean;
};

export function Label({
  htmlFor,
  children,
  className,
}: {
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={cn('block text-label text-muted-foreground', className)}>
      {children}
    </label>
  );
}

export function Input({
  className,
  invalid,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & FieldState) {
  return (
    <input
      className={cn(fieldBase, invalid ? fieldErr : fieldOk, className)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

export function Select({
  className,
  invalid,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & FieldState) {
  return (
    <select
      className={cn(fieldBase, invalid ? fieldErr : fieldOk, className)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

export function Textarea({
  className,
  invalid,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & FieldState) {
  return (
    <textarea
      className={cn(fieldBase, invalid ? fieldErr : fieldOk, className)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}
