'use client';

import { Eye, EyeOff } from 'lucide-react';
import { forwardRef, useId, useState, type InputHTMLAttributes } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/field';

type FieldState = {
  invalid?: boolean;
  fieldSize?: 'sm' | 'md';
};

export const PasswordInput = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & FieldState
>(function PasswordInput({ className, invalid, fieldSize = 'md', id, ...rest }, ref) {
  const t = useTranslations('Auth');
  const [visible, setVisible] = useState(false);
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const toggleLabel = visible ? t('hidePassword') : t('showPassword');

  return (
    <div className={cn('relative', fieldSize === 'md' ? 'mt-1' : 'mt-0')}>
      <Input
        ref={ref}
        id={inputId}
        invalid={invalid}
        fieldSize={fieldSize}
        className={cn('mt-0 pr-11', className)}
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
        {...rest}
        type={visible ? 'text' : 'password'}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted-foreground transition duration-fast hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
        aria-label={toggleLabel}
        aria-pressed={visible}
        tabIndex={0}
      >
        {visible ? (
          <EyeOff className="h-4 w-4" aria-hidden />
        ) : (
          <Eye className="h-4 w-4" aria-hidden />
        )}
      </button>
    </div>
  );
});
