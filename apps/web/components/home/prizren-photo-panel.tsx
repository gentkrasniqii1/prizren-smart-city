'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { HERITAGE_GALLERY } from '@/lib/prizren-photos';
import { cn } from '@/lib/utils';

/** Fortress shot — one well-composed photo, not a cramped gallery. */
const PLACE = HERITAGE_GALLERY[0];

export function PrizrenPhotoPanel({
  variant = 'fill',
  className,
  sizes,
  onNavigate,
}: {
  /** `fill` grows with the parent flex area; `sidebar` uses a fixed 4/3 frame. */
  variant?: 'fill' | 'sidebar';
  className?: string;
  sizes?: string;
  onNavigate?: () => void;
}) {
  const t = useTranslations('Home');
  const caption = t(`heritage.places.${PLACE.nameKey}`);
  const fill = variant === 'fill';

  return (
    <Link
      href="/#heritage"
      onClick={onNavigate}
      className={cn(
        'group min-h-0',
        fill ? 'flex h-full min-h-0 flex-1 flex-col' : 'block',
        className,
      )}
    >
      <figure
        className={cn(
          'flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card',
          fill && 'h-full flex-1',
        )}
      >
        <div
          className={cn(
            'relative overflow-hidden bg-muted',
            fill ? 'min-h-0 flex-1' : 'aspect-[4/3]',
          )}
        >
          <Image
            src={PLACE.src}
            alt={caption}
            fill
            sizes={
              sizes ?? (fill ? '(max-width: 1024px) 24rem, 0px' : '(min-width: 1024px) 28rem, 0px')
            }
            quality={75}
            className="object-cover transition duration-slow ease-product group-hover:scale-[1.02]"
          />
        </div>
        <figcaption className="shrink-0 px-3 py-2.5">
          <p className="text-caption font-medium tracking-[0.04em] text-stone-700">{caption}</p>
        </figcaption>
      </figure>
    </Link>
  );
}
