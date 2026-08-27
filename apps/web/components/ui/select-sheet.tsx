'use client';

import {
  Children,
  isValidElement,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { fieldClass } from '@/components/ui/field';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useIsLg } from '@/lib/use-media-query';
import { cn } from '@/lib/utils';

export type SelectSheetOption = { value: string; label: string };

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> & {
  title: string;
  invalid?: boolean;
  fieldSize?: 'sm' | 'md';
  options?: SelectSheetOption[];
  children?: ReactNode;
};

function optionsFromChildren(children: ReactNode): SelectSheetOption[] {
  const options: SelectSheetOption[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type !== 'option') return;
    const props = child.props as { value?: string | number; children?: ReactNode };
    const label =
      typeof props.children === 'string' || typeof props.children === 'number'
        ? String(props.children)
        : Children.toArray(props.children).join('');
    options.push({ value: String(props.value ?? ''), label });
  });
  return options;
}

function emitChange(onChange: SelectHTMLAttributes<HTMLSelectElement>['onChange'], value: string) {
  if (!onChange) return;
  onChange({ target: { value } } as ChangeEvent<HTMLSelectElement>);
}

export function SelectSheet({
  id,
  title,
  value,
  onChange,
  options,
  children,
  className,
  invalid,
  fieldSize = 'md',
  disabled,
  name,
}: Props) {
  const [open, setOpen] = useState(false);
  const isLg = useIsLg();
  const resolvedOptions = useMemo(
    () => (options && options.length > 0 ? options : optionsFromChildren(children)),
    [options, children],
  );
  const current = String(value ?? '');
  const selectedLabel =
    resolvedOptions.find((o) => o.value === current)?.label ?? resolvedOptions[0]?.label ?? '';

  function pick(next: string) {
    emitChange(onChange, next);
    setOpen(false);
  }

  const triggerClass = cn(
    fieldClass(invalid, fieldSize),
    'flex items-center justify-between gap-2 text-left',
    className,
  );

  const trigger = (
    <button
      type="button"
      id={id}
      name={name}
      disabled={disabled}
      aria-label={title}
      className={triggerClass}
    >
      <span className="min-w-0 truncate">{selectedLabel}</span>
      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  );

  const optionButtons = resolvedOptions.map((o) => {
    const selected = o.value === current;
    return (
      <li key={o.value || '__all'}>
        <button
          type="button"
          onClick={() => pick(o.value)}
          className={cn(
            'flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left text-sm transition duration-fast ease-product',
            selected
              ? 'bg-muted font-semibold text-foreground'
              : 'text-foreground hover:bg-muted/60',
          )}
          aria-pressed={selected}
        >
          <span className="min-w-0 flex-1">{o.label}</span>
          {selected ? <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden /> : null}
        </button>
      </li>
    );
  });

  if (isLg) {
    return (
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild disabled={disabled}>
          {trigger}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          side="bottom"
          sideOffset={4}
          collisionPadding={{ top: 72, bottom: 16 }}
          className="z-50 min-w-[var(--radix-dropdown-menu-trigger-width)]"
        >
          {resolvedOptions.map((o) => {
            const selected = o.value === current;
            return (
              <DropdownMenuItem
                key={o.value || '__all'}
                onSelect={() => pick(o.value)}
                className={cn(selected && 'font-semibold')}
              >
                <span className="min-w-0 flex-1">{o.label}</span>
                {selected ? <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden /> : null}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <>
      <button
        type="button"
        id={id}
        name={name}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={title}
        className={triggerClass}
        onClick={() => setOpen(true)}
      >
        <span className="min-w-0 truncate">{selectedLabel}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[min(70svh,32rem)] gap-0 rounded-t-2xl border-border p-0 sm:mx-auto sm:max-w-lg"
        >
          <SheetHeader className="space-y-0 border-b border-border px-4 py-3 pr-14 text-left">
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
          <ul className="max-h-[min(60svh,28rem)] overflow-y-auto overscroll-contain p-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {optionButtons}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}
