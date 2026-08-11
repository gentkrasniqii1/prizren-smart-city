import type {
  ReactNode,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/utils';

const fieldBase =
  'mt-1 w-full min-h-11 rounded-md border bg-white px-3 py-2.5 text-base text-stone-900 outline-none transition duration-fast ease-product placeholder:text-stone-400 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-500 sm:min-h-10 sm:py-2 sm:text-sm';

const fieldOk =
  'border-stone-300 hover:border-stone-400 focus:border-mosque-500 focus:ring-2 focus:ring-mosque-200';

const fieldErr = 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100';

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
    <label htmlFor={htmlFor} className={cn('block text-label text-stone-700', className)}>
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
