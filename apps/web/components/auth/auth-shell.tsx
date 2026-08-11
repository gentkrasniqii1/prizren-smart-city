import Image from 'next/image';
import type { ReactNode } from 'react';
import { BrandMark } from '@/components/brand';

export function AuthShell({
  imageSrc,
  imageAlt,
  panelTitle,
  panelBody,
  children,
}: {
  imageSrc: string;
  imageAlt: string;
  panelTitle: string;
  panelBody: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto grid min-h-[calc(100vh-4.5rem)] max-w-6xl lg:grid-cols-2">
      <div className="relative hidden overflow-hidden lg:block">
        <Image src={imageSrc} alt={imageAlt} fill className="object-cover" sizes="50vw" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950/85 via-stone-950/30 to-stone-950/35" />
        <div className="absolute inset-x-0 bottom-0 p-8 text-stone-50 sm:p-10">
          <div className="inline-flex items-center gap-3">
            <BrandMark className="h-10 w-10 shrink-0" />
            <span className="font-display text-lg font-semibold tracking-tight">
              Prizren Smart City
            </span>
          </div>
          <p className="mt-6 font-display text-2xl leading-snug tracking-tight sm:text-3xl">
            {panelTitle}
          </p>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-stone-200/90">{panelBody}</p>
        </div>
      </div>

      <div className="flex flex-col justify-center px-4 py-12 sm:px-10 lg:px-12">
        <div className="mb-8 inline-flex items-center gap-2.5 lg:hidden">
          <BrandMark className="h-8 w-8 shrink-0" />
          <span className="font-display text-base font-semibold tracking-tight text-stone-950">
            Prizren Smart City
          </span>
        </div>
        {children}
      </div>
    </main>
  );
}
