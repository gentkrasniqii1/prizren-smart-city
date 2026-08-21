'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/** Local city photos. Sources and licenses: public/images/prizren/CREDITS.md */
export const AUTH_HERO_SLIDES = [
  '/images/prizren/fortress.jpg',
  '/images/prizren/stone-bridge-mosque.jpg',
  '/images/prizren/shadervan.jpg',
  '/images/prizren/sunset-mosque.jpg',
  '/images/prizren/old-town-summer.jpg',
  '/images/prizren/night.jpg',
  '/images/prizren/stone-bridge-autumn.jpg',
  '/images/prizren/cityscape.jpg',
  '/images/prizren/sinan-pasha-from-bridge.jpg',
  '/images/prizren/stone-bridge.jpg',
] as const;

const INTERVAL_MS = 3000;
const FADE_MS = 700;

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
          quality={80}
          priority={priority && i === 0}
          sizes={sizes}
          className={cn(
            'object-cover transition-opacity ease-in-out',
            objectPosition,
            i === index ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
          style={{ transitionDuration: `${FADE_MS}ms` }}
        />
      ))}
    </div>
  );
}
