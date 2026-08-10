'use client';

import Image from 'next/image';

type Props = {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
};

/** Cloudinary / remote photos with Next Image + lazy loading. Falls back to native img if URL is local blob. */
export function RemoteImage({
  src,
  alt,
  className = '',
  sizes = '(max-width: 768px) 100vw, 640px',
  priority = false,
}: Props) {
  if (src.startsWith('blob:') || src.startsWith('data:')) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className={className} />;
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={960}
      height={720}
      sizes={sizes}
      className={className}
      loading={priority ? undefined : 'lazy'}
      priority={priority}
    />
  );
}
