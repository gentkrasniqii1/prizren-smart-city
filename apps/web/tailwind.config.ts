import type { Config } from 'tailwindcss';

/**
 * Our CSS custom properties hold plain hex strings (e.g. `--color-stone-950: #27211c`),
 * not the space-separated `R G B` channel format Tailwind's `rgb(var(--x) / <alpha-value>)`
 * opacity trick needs. Without this, Tailwind silently drops any `/NN` opacity modifier
 * applied to these tokens (e.g. `from-stone-950/85`, `bg-mosque-50/70`) — the utility
 * compiles to nothing, so the "opacity" variant is simply invisible/inert everywhere it's
 * used. `color-mix()` works directly against a hex-valued custom property, so we use it as
 * the opacity mechanism instead. Supported by all evergreen browsers.
 */
// Tailwind's own `Config['theme']['colors']` type doesn't model per-key
// functions (only `theme.colors` as a whole may be a function), even though
// Tailwind fully supports function-valued colors at runtime — this is a
// known gap in `tailwindcss`'s bundled types. We declare the return type as
// `string` and cast the actual function value through `unknown` so the
// config still type-checks while Tailwind receives the real function.
function withOpacity(varName: string): string {
  const resolver = ({ opacityValue }: { opacityValue?: string }) => {
    // Tailwind passes a `var(--tw-bg-opacity, 1)`-style string here even for
    // unmodified utilities (legacy opacity-utility compat) — only engage
    // color-mix() when we get a genuine numeric fraction from a `/NN` modifier,
    // otherwise fall through to the plain var so the base color still renders.
    const fraction = opacityValue !== undefined ? Number(opacityValue) : NaN;
    return Number.isFinite(fraction)
      ? `color-mix(in srgb, var(${varName}) ${fraction * 100}%, transparent)`
      : `var(${varName})`;
  };
  return resolver as unknown as string;
}

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: withOpacity('--background'),
        foreground: withOpacity('--foreground'),
        card: {
          DEFAULT: withOpacity('--card'),
          foreground: withOpacity('--card-foreground'),
        },
        popover: {
          DEFAULT: withOpacity('--popover'),
          foreground: withOpacity('--popover-foreground'),
        },
        border: withOpacity('--border'),
        input: withOpacity('--input'),
        muted: {
          DEFAULT: withOpacity('--muted'),
          foreground: withOpacity('--muted-foreground'),
        },
        secondary: {
          DEFAULT: withOpacity('--secondary'),
          foreground: withOpacity('--secondary-foreground'),
        },
        destructive: {
          DEFAULT: withOpacity('--destructive'),
          foreground: withOpacity('--destructive-foreground'),
        },
        ring: withOpacity('--ring'),
        stone: {
          50: withOpacity('--color-stone-50'),
          100: withOpacity('--color-stone-100'),
          200: withOpacity('--color-stone-200'),
          300: withOpacity('--color-stone-300'),
          400: withOpacity('--color-stone-400'),
          500: withOpacity('--color-stone-500'),
          600: withOpacity('--color-stone-600'),
          700: withOpacity('--color-stone-700'),
          800: withOpacity('--color-stone-800'),
          900: withOpacity('--color-stone-900'),
          950: withOpacity('--color-stone-950'),
        },
        mosque: {
          50: withOpacity('--color-mosque-50'),
          100: withOpacity('--color-mosque-100'),
          200: withOpacity('--color-mosque-200'),
          300: withOpacity('--color-mosque-300'),
          400: withOpacity('--color-mosque-400'),
          500: withOpacity('--color-mosque-500'),
          600: withOpacity('--color-mosque-600'),
          700: withOpacity('--color-mosque-700'),
          800: withOpacity('--color-mosque-800'),
          900: withOpacity('--color-mosque-900'),
          950: withOpacity('--color-mosque-950'),
        },
        river: {
          50: withOpacity('--color-river-50'),
          100: withOpacity('--color-river-100'),
          200: withOpacity('--color-river-200'),
          300: withOpacity('--color-river-300'),
          400: withOpacity('--color-river-400'),
          500: withOpacity('--color-river-500'),
          600: withOpacity('--color-river-600'),
          700: withOpacity('--color-river-700'),
          800: withOpacity('--color-river-800'),
          900: withOpacity('--color-river-900'),
          950: withOpacity('--color-river-950'),
        },
        primary: {
          DEFAULT: withOpacity('--primary'),
          foreground: withOpacity('--primary-foreground'),
          hover: withOpacity('--primary-hover'),
        },
        accent: {
          DEFAULT: withOpacity('--accent'),
          foreground: withOpacity('--accent-foreground'),
        },
        overlay: {
          surface: withOpacity('--overlay-surface'),
          foreground: withOpacity('--overlay-foreground'),
          muted: withOpacity('--overlay-foreground-muted'),
        },
        chip: {
          foreground: withOpacity('--chip-foreground'),
        },
        gilt: withOpacity('--gilt'),
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        display: ['2.25rem', { lineHeight: '1.15', fontWeight: '600' }],
        h1: ['1.875rem', { lineHeight: '1.2', fontWeight: '600' }],
        h2: ['1.5rem', { lineHeight: '1.25', fontWeight: '600' }],
        h3: ['1.25rem', { lineHeight: '1.3', fontWeight: '600' }],
        caption: ['0.75rem', { lineHeight: '1.4', fontWeight: '500' }],
        label: ['0.875rem', { lineHeight: '1.4', fontWeight: '500' }],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      boxShadow: {
        soft: 'var(--shadow-md)',
        lift: 'var(--shadow-lg)',
        sm: 'var(--shadow-sm)',
      },
      transitionDuration: {
        fast: 'var(--motion-fast)',
        normal: 'var(--motion-normal)',
        slow: 'var(--motion-slow)',
      },
      transitionTimingFunction: {
        product: 'var(--motion-ease)',
      },
      keyframes: {
        'motion-fade-up': {
          from: { opacity: '0', transform: 'translateY(0.75rem)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'motion-fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'motion-slide-up': {
          from: { opacity: '0', transform: 'translateY(1.25rem)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'motion-slide-in-right': {
          from: { opacity: '0', transform: 'translateX(0.85rem)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-up': 'motion-fade-up var(--motion-slow) var(--motion-ease) both',
        'fade-in': 'motion-fade-in var(--motion-normal) var(--motion-ease) both',
        'slide-up': 'motion-slide-up var(--motion-slow) var(--motion-ease) both',
        'slide-in-right': 'motion-slide-in-right var(--motion-slow) var(--motion-ease) both',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
export default config;
