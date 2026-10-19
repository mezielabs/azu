import { textOn, withContrast } from './color.ts'

/**
 * Azu's light and dark palettes (FR-14), as the CSS variables its
 * stylesheet uses (non-negotiable 9). The brand colour from
 * `config/azu.ts` drives the brand tokens; neutrals, danger, success
 * and badge colours are fixed per theme. Every text pair reaches WCAG
 * AA's 4.5:1, and `palette.spec.ts` checks it for many brand colours.
 */

export type ThemeName = 'light' | 'dark'

export const BADGE_COLORS = ['gray', 'green', 'blue', 'red', 'yellow'] as const

export type Palette = Record<string, string>

const NEUTRALS: Record<ThemeName, Palette> = {
  light: {
    surface: '#ffffff',
    subtle: '#f4f4f5',
    text: '#18181b',
    muted: '#52525b',
    border: '#e4e4e7',
  },
  dark: {
    surface: '#09090b',
    subtle: '#18181b',
    text: '#fafafa',
    muted: '#a1a1aa',
    border: '#3f3f46',
  },
}

/** Fixed colours: [background, text] for badges */
const BADGES: Record<ThemeName, Record<(typeof BADGE_COLORS)[number], [string, string]>> = {
  light: {
    gray: ['#f4f4f5', '#3f3f46'],
    green: ['#dcfce7', '#166534'],
    blue: ['#dbeafe', '#1e40af'],
    red: ['#fee2e2', '#991b1b'],
    yellow: ['#fef9c3', '#854d0e'],
  },
  dark: {
    gray: ['#27272a', '#e4e4e7'],
    green: ['#052e16', '#86efac'],
    blue: ['#172554', '#93c5fd'],
    red: ['#450a0a', '#fca5a5'],
    yellow: ['#422006', '#fde047'],
  },
}

const DANGER: Record<ThemeName, { text: string; solid: string; subtle: string; border: string }> = {
  light: { text: '#b91c1c', solid: '#dc2626', subtle: '#fef2f2', border: '#fca5a5' },
  dark: { text: '#f87171', solid: '#dc2626', subtle: '#2a0e0e', border: '#7f1d1d' },
}

const SUCCESS: Record<ThemeName, string> = { light: '#16a34a', dark: '#22c55e' }

/**
 * One theme's palette from the brand colour. `brand` is the colour as
 * text and accents (links, the current nav item, focus rings): its OKLCH
 * lightness moves only as far as 4.5:1 against the surfaces needs, so
 * the hue stays. Filled brand areas (primary buttons, a selected date)
 * use the same colour, with white or near-black text on top.
 */
export function palette(brandColor: string, theme: ThemeName): Palette {
  const neutral = NEUTRALS[theme]
  const brand = withContrast(brandColor, [neutral.surface, neutral.subtle], 4.5)
  const danger = DANGER[theme]
  const tokens: Palette = {
    ...neutral,
    'brand': brand,
    'brand-solid': brand,
    'on-brand': textOn(brand),
    'danger': withContrast(danger.text, [neutral.surface, neutral.subtle, danger.subtle], 4.5),
    'danger-solid': danger.solid,
    'on-danger': textOn(danger.solid),
    'danger-subtle': danger.subtle,
    'danger-border': danger.border,
    'success': SUCCESS[theme],
  }
  for (const color of BADGE_COLORS) {
    const [background, text] = BADGES[theme][color]
    tokens[`badge-${color}-bg`] = background
    tokens[`badge-${color}-text`] = withContrast(text, [background], 4.5)
  }
  return tokens
}

function declarations(tokens: Palette, colorScheme: ThemeName) {
  const lines = Object.entries(tokens).map(([name, value]) => `--azu-${name}:${value};`)
  return `color-scheme:${colorScheme};${lines.join('')}`
}

/**
 * The palettes as CSS for the admin's root view. Light by default;
 * dark when the OS prefers it, unless the user chose light, or when
 * they chose dark (`data-azu-theme` on `<html>`, set from
 * `localStorage` before the first paint).
 */
export function themeCss(brandColor: string): string {
  const light = declarations(palette(brandColor, 'light'), 'light')
  const dark = declarations(palette(brandColor, 'dark'), 'dark')
  return [
    `:root{${light}}`,
    `@media (prefers-color-scheme: dark){:root:not([data-azu-theme="light"]){${dark}}}`,
    `:root[data-azu-theme="dark"]{${dark}}`,
  ].join('\n')
}
