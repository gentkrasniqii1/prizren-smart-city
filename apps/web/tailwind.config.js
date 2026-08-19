/**
 * Our CSS custom properties hold plain hex strings (e.g. `--color-stone-950: #27211c`),
 * not the space-separated `R G B` channel format Tailwind's `rgb(var(--x) / <alpha-value>)`
 * opacity trick needs. Without this, Tailwind silently drops any `/NN` opacity modifier
 * applied to these tokens (e.g. `from-stone-950/85`, `bg-mosque-50/70`) — the utility
 * compiles to nothing, so the "opacity" variant is simply invisible/inert everywhere it's
 * used. `color-mix()` works directly against a hex-valued custom property, so we use it as
 * the opacity mechanism instead. Supported by all evergreen browsers.
 *
 * Plain JS (not TS) so Tailwind can `require()` this file on Windows without jiti writing
 * a transform cache under `%TEMP%\node-jiti\`.
 */

/**
 * @param {string} varName
 * @returns {(info: { opacityValue?: string }) => string}
 */
function withOpacity(varName) {
  return ({ opacityValue }) => {
    // Tailwind passes a `var(--tw-bg-opacity, 1)`-style string here even for
    // unmodified utilities (legacy opacity-utility compat) — only engage
    // color-mix() when we get a genuine numeric fraction from a `/NN` modifier,
    // otherwise fall through to the plain var so the base color still renders.
    const fraction = opacityValue !== undefined ? Number(opacityValue) : NaN;
    return Number.isFinite(fraction)
      ? `color-mix(in srgb, var(${varName}) ${fraction * 100}%, transparent)`
      : `var(${varName})`;
  };
}

/** @type {import('tailwindcss').Config} */
const config = {
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
        semantic: {
          success: {
            DEFAULT: withOpacity('--semantic-success'),
            foreground: withOpacity('--semantic-success-foreground'),
          },
          warning: {
            DEFAULT: withOpacity('--semantic-warning'),
            foreground: withOpacity('--semantic-warning-foreground'),
          },
          danger: {
            DEFAULT: withOpacity('--semantic-danger'),
            foreground: withOpacity('--semantic-danger-foreground'),
          },
          info: {
            DEFAULT: withOpacity('--semantic-info'),
            foreground: withOpacity('--semantic-info-foreground'),
          },
          caution: {
            DEFAULT: withOpacity('--semantic-caution'),
            foreground: withOpacity('--semantic-caution-foreground'),
          },
        },
        status: {
          pending: {
            DEFAULT: withOpacity('--status-pending'),
            foreground: withOpacity('--status-pending-foreground'),
          },
          review: {
            DEFAULT: withOpacity('--status-review'),
            foreground: withOpacity('--status-review-foreground'),
          },
          assigned: {
            DEFAULT: withOpacity('--status-assigned'),
            foreground: withOpacity('--status-assigned-foreground'),
          },
          progress: {
            DEFAULT: withOpacity('--status-progress'),
            foreground: withOpacity('--status-progress-foreground'),
          },
          waiting: {
            DEFAULT: withOpacity('--status-waiting'),
            foreground: withOpacity('--status-waiting-foreground'),
          },
          resolved: {
            DEFAULT: withOpacity('--status-resolved'),
            foreground: withOpacity('--status-resolved-foreground'),
          },
          rejected: {
            DEFAULT: withOpacity('--status-rejected'),
            foreground: withOpacity('--status-rejected-foreground'),
          },
          duplicate: {
            DEFAULT: withOpacity('--status-duplicate'),
            foreground: withOpacity('--status-duplicate-foreground'),
          },
        },
      },
      spacing: {
        cluster: 'var(--space-cluster)',
        gutter: 'var(--space-gutter)',
        inset: 'var(--space-inset)',
        stack: 'var(--space-stack)',
        section: 'var(--space-section)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        display: ['2.25rem', { lineHeight: '1.15', fontWeight: '600', letterSpacing: '-0.02em' }],
        'display-lg': [
          '3rem',
          { lineHeight: '1.15', fontWeight: '600', letterSpacing: '-0.025em' },
        ],
        'display-xl': [
          '3.75rem',
          { lineHeight: '1.1', fontWeight: '600', letterSpacing: '-0.03em' },
        ],
        h1: ['1.875rem', { lineHeight: '1.2', fontWeight: '600', letterSpacing: '-0.02em' }],
        h2: ['1.5rem', { lineHeight: '1.25', fontWeight: '600', letterSpacing: '-0.015em' }],
        h3: ['1.25rem', { lineHeight: '1.3', fontWeight: '600', letterSpacing: '-0.01em' }],
        body: ['1rem', { lineHeight: '1.55', fontWeight: '400', letterSpacing: '0' }],
        small: ['0.875rem', { lineHeight: '1.45', fontWeight: '400', letterSpacing: '0' }],
        caption: ['0.75rem', { lineHeight: '1.4', fontWeight: '500', letterSpacing: '0.01em' }],
        label: ['0.875rem', { lineHeight: '1.4', fontWeight: '500', letterSpacing: '0' }],
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

module.exports = config;
