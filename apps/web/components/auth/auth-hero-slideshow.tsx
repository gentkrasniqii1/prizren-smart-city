'use client';

import { PrizrenSlideshow } from '@/components/media/prizren-slideshow';

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
  return (
    <PrizrenSlideshow
      slides={AUTH_HERO_SLIDES}
      alt={alt}
      sizes={sizes}
      objectPosition={objectPosition}
      intervalMs={INTERVAL_MS}
      fadeMs={FADE_MS}
      priority={priority}
    />
  );
}
