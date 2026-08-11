'use client';

import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Delay = 0 | 1 | 2 | 3 | 4;

/**
 * One-shot scroll reveal. Respects prefers-reduced-motion via CSS (always visible).
 */
export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  delay?: Delay;
  as?: 'div' | 'li' | 'section';
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);
  const Comp = Tag as ElementType;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof window.matchMedia === 'function') {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (reduce.matches) {
        setVisible(true);
        return;
      }
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Comp
      ref={ref}
      className={cn(
        'motion-reveal',
        delay > 0 && `motion-delay-${delay}`,
        visible && 'is-visible',
        className,
      )}
    >
      {children}
    </Comp>
  );
}
