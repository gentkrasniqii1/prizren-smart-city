import { cn } from '@/lib/utils';

type LogoTheme = 'light' | 'dark';

/**
 * Monogram "P" mark — entirely typographic (the project's own display serif,
 * `--font-display` / Fraunces), cut with a hairline weight, read from the
 * right as three signal lines + a node: the citizen's report reaching the
 * city. Kept in sync with the static assets in `/public` (favicon, PWA
 * icons, apple-touch-icon) for contexts that can't use React/CSS variables.
 */
function LogoIcon({
  theme,
  size,
  className,
  decorative,
}: {
  theme?: LogoTheme;
  size: number;
  className?: string;
  decorative?: boolean;
}) {
  // No explicit theme -> inherit `currentColor` so the mark follows the
  // ambient text color (and therefore the site's light/dark mode) for free.
  // Explicit theme forces a fixed (non-theme-flipping) ink token — used when
  // the mark sits on a surface that doesn't follow the site's active theme
  // (e.g. a photo overlay that is always dark, or a chip that stays white).
  const ink =
    theme === 'light'
      ? 'var(--chip-foreground)'
      : theme === 'dark'
        ? 'var(--overlay-foreground)'
        : 'currentColor';
  const width = (size * 168) / 100;

  return (
    <span
      className={cn('relative inline-block shrink-0', className)}
      style={{ width, height: size }}
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : 'Prizren Smart City'}
    >
      {/* HTML letter — SVG <text>/<tspan> hydrates as a different node in some browsers. */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-0 font-display font-light leading-none"
        style={{
          top: '8%',
          fontSize: size * 0.98,
          color: ink,
        }}
      >
        P
      </span>
      <svg
        width={width}
        height={size}
        viewBox="0 0 168 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
        className="absolute inset-0"
      >
        <line x1="70" y1="14" x2="70" y2="86" stroke={ink} strokeWidth="1" opacity="0.3" />
        <g stroke="var(--brand-accent-gold)" strokeWidth="3.5" strokeLinecap="round">
          <line x1="84" y1="32" x2="103" y2="32" />
          <line x1="84" y1="46" x2="115" y2="46" />
          <line x1="84" y1="60" x2="123" y2="60" />
        </g>
        <rect
          x="80.5"
          y="70.5"
          width="7"
          height="7"
          fill="var(--brand-accent-gold)"
          transform="rotate(45 84 74)"
        />
      </svg>
    </span>
  );
}

export function Logo({
  variant = 'full',
  theme,
  size = 36,
  compact = false,
  className,
}: {
  /** "icon" renders just the mark; "full" adds the wordmark + subtext. */
  variant?: 'icon' | 'full';
  /** Force a fixed light ("light") or dark ("dark") surface ink. Omit to follow the current theme. */
  theme?: LogoTheme;
  /** Icon size in pixels (height — width is derived from the mark's aspect ratio). */
  size?: number;
  /** Hide the "SMART CITY" line (mobile / tight spaces). */
  compact?: boolean;
  className?: string;
}) {
  if (variant === 'icon') {
    return <LogoIcon theme={theme} size={size} className={className} />;
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2.5',
        theme === 'dark' ? 'text-overlay-foreground' : 'text-foreground',
        className,
      )}
    >
      <LogoIcon theme={theme} size={size} decorative />
      <span className="leading-tight">
        <span className="block font-display text-base font-semibold tracking-[0.08em] sm:text-lg">
          PRIZREN
        </span>
        {!compact ? (
          <span className="hidden text-[11px] font-semibold uppercase tracking-[0.22em] text-gilt sm:block">
            Smart City
          </span>
        ) : null}
      </span>
    </span>
  );
}
