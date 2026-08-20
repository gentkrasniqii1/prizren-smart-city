'use client';

import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

export type FilterTabOption<T extends string> = {
  id: T;
  label: string;
};

export function FilterTabs<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
  children,
}: {
  value: T;
  options: FilterTabOption<T>[];
  onChange: (id: T) => void;
  label: string;
  className?: string;
  children?: ReactNode;
}) {
  const uid = useId();
  const panelId = `${uid}-panel`;
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function focusIndex(index: number) {
    requestAnimationFrame(() => refs.current[index]?.focus());
  }

  function selectIndex(index: number) {
    const next = options[index];
    if (!next) return;
    onChange(next.id);
    focusIndex(index);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const i = options.findIndex((opt) => opt.id === value);
    if (i < 0) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      selectIndex((i + 1) % options.length);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      selectIndex((i - 1 + options.length) % options.length);
    } else if (e.key === 'Home') {
      e.preventDefault();
      selectIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      selectIndex(options.length - 1);
    }
  }

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label={label}
        className="flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1"
        onKeyDown={onKeyDown}
      >
        {options.map((opt, i) => {
          const selected = value === opt.id;
          return (
            <Button
              key={opt.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${uid}-tab-${opt.id}`}
              aria-controls={panelId}
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              size="sm"
              variant={selected ? 'secondary' : 'ghost'}
              onClick={() => onChange(opt.id)}
            >
              {opt.label}
            </Button>
          );
        })}
      </div>
      {children ? (
        <div role="tabpanel" id={panelId} aria-labelledby={`${uid}-tab-${value}`} className="mt-6">
          {children}
        </div>
      ) : null}
    </div>
  );
}
