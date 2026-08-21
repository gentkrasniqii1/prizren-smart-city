'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export function PrizrenSlideshow({
  slides,
  alt,
  sizes,
  objectPosition = 'object-center',
  intervalMs = 4500,
  fadeMs = 800,
  priority = false,
}: {
  slides: readonly string[];
  alt: string;
  sizes: string;
  objectPosition?: string;
  intervalMs?: number;
  fadeMs?: number;
  priority?: boolean;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, slides.length]);

  return (
    <div className="absolute inset-0">
      {slides.map((src, i) => (
        <Image
          key={src}
          src={src}
          alt={i === index ? alt : ''}
          fill
          quality={80}
          priority={priority && i === 0}
          sizes={sizes}
          className={cn(
            'object-cover transition-opacity ease-in-out',
            objectPosition,
            i === index ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
          style={{ transitionDuration: `${fadeMs}ms` }}
        />
      ))}
    </div>
  );
}
