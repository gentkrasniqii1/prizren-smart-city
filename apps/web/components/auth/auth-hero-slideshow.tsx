'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/** Local Wikimedia-sourced city photos (see public/images/prizren/CREDITS.md). */
export const AUTH_HERO_SLIDES = [
  '/images/prizren/overview.jpg',
  '/images/prizren/stone-bridge.jpg',
  '/images/prizren/kalaja.jpg',
  '/images/prizren/sinan-pasha.jpg',
  '/images/prizren/old-town.jpg',
  '/images/prizren/bistrica.jpg',
] as const;

const INTERVAL_MS = 6500;

export function AuthHeroSlideshow({
  alt,
  sizes,
  objectPosition = 'object-[center_70%]',
  priority = false,
}: {
  alt: string;
  sizes: string;
  objectPosition?: string;
  priority?: boolean;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % AUTH_HERO_SLIDES.length);
    }, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="absolute inset-0">
      {AUTH_HERO_SLIDES.map((src, i) => (
        <Image
          key={src}
          src={src}
          alt={i === index ? alt : ''}
          fill
          quality={92}
          priority={priority && i === 0}
          sizes={sizes}
          className={cn(
            'object-cover transition-opacity ease-in-out',
            objectPosition,
            i === index ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
          style={{ transitionDuration: '1.2s' }}
        />
      ))}
    </div>
  );
}
