type Props = {
  className?: string;
  title?: string;
};

/** Original geometric mark — castle silhouette + map pin cue (not the municipal coat of arms). */
export function BrandMark({ className = 'h-8 w-8', title = 'Prizren Smart City' }: Props) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <rect width="64" height="64" rx="14" fill="#335f9b" />
      <path
        d="M32 10 L48 22 V38 L40 44 V36 H24 V44 L16 38 V22 Z"
        fill="#faf8f5"
        fillOpacity="0.95"
      />
      <path d="M28 28 H36 V36 H28 Z" fill="#335f9b" />
      <circle cx="32" cy="50" r="4.5" fill="#3a9b8c" />
      <path d="M32 46 V42" stroke="#3a9b8c" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function BrandWordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <BrandMark className="h-8 w-8 shrink-0" />
      <span className="leading-tight">
        <span className="block font-display text-base font-semibold tracking-tight text-stone-950 sm:text-lg">
          {compact ? 'PSC' : 'Prizren Smart City'}
        </span>
        {!compact ? (
          <span className="hidden text-[11px] uppercase tracking-[0.16em] text-stone-500 sm:block">
            Civic reporting
          </span>
        ) : null}
      </span>
    </span>
  );
}
