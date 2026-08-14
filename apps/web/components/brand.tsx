/**
 * Brand mark: abstract stone-bridge arch + location node + civic network.
 * Theme-aware via CSS variables (works in light & dark).
 */
type Props = {
  className?: string;
  title?: string;
};

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
      <rect width="64" height="64" rx="14" fill="var(--primary)" />
      <path
        d="M12 38 H52"
        stroke="var(--primary-foreground)"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.95"
      />
      <path
        d="M16 38 C16 28 24 24 32 24 C40 24 48 28 48 38"
        stroke="var(--primary-foreground)"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.95"
      />
      <path
        d="M22 38 C22 32 27 29 32 29 C37 29 42 32 42 38"
        stroke="var(--primary-foreground)"
        strokeWidth="1.75"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
      <circle cx="32" cy="20" r="3.25" fill="var(--accent)" />
      <path d="M32 23.5 V28" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="18" cy="46" r="1.75" fill="var(--primary-foreground)" opacity="0.45" />
      <circle cx="32" cy="48" r="1.75" fill="var(--primary-foreground)" opacity="0.7" />
      <circle cx="46" cy="46" r="1.75" fill="var(--primary-foreground)" opacity="0.45" />
      <path
        d="M20 46 H30 M34 48 H44"
        stroke="var(--primary-foreground)"
        strokeWidth="1.25"
        opacity="0.35"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BrandWordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5 text-foreground">
      <BrandMark className="h-8 w-8 shrink-0" />
      <span className="leading-tight">
        <span className="block font-display text-base font-semibold tracking-tight text-foreground sm:text-lg">
          {compact ? 'PSC' : 'Prizren Smart City'}
        </span>
        {!compact ? (
          <span className="hidden text-[11px] uppercase tracking-[0.16em] text-muted-foreground sm:block">
            Civic reporting
          </span>
        ) : null}
      </span>
    </span>
  );
}
