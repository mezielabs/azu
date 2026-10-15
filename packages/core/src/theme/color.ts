/**
 * Colour maths for the generated palettes (FR-14): sRGB hex, WCAG 2
 * contrast, and OKLCH, where changing the lightness keeps the hue.
 * Plain TypeScript, no dependency.
 */

export type Rgb = [number, number, number]

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

export function isHexColor(value: string): boolean {
  return HEX.test(value.trim())
}

/** `#2563eb` or `#26e` → channels 0–255 */
export function parseHex(value: string): Rgb {
  const match = HEX.exec(value.trim())
  if (!match) throw new Error(`"${value}" is not a hex colour like #2563eb`)
  const hex =
    match[1].length === 3 ? [...match[1]].map((digit) => digit + digit).join('') : match[1]
  return [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16)) as Rgb
}

export function toHex(rgb: Rgb): string {
  return `#${rgb.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`
}

function linear(channel: number) {
  const value = channel / 255
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

function gamma(value: number) {
  const clamped = Math.min(1, Math.max(0, value))
  return 255 * (clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055)
}

/** WCAG 2 relative luminance */
export function luminance(color: string): number {
  const [r, g, b] = parseHex(color).map(linear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG 2 contrast ratio, 1 to 21 */
export function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

export type Oklch = { l: number; c: number; h: number }

/** sRGB → OKLCH (Björn Ottosson's OKLab) */
export function toOklch(color: string): Oklch {
  const [r, g, b] = parseHex(color).map(linear)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return { l: L, c: Math.hypot(A, B), h: Math.atan2(B, A) }
}

/** OKLCH → sRGB hex, clamped into the sRGB gamut */
export function fromOklch({ l: L, c, h }: Oklch): string {
  const A = c * Math.cos(h)
  const B = c * Math.sin(h)
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3
  return toHex([
    gamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    gamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    gamma(-0.0041960863 * l - 0.7034186147 * m + 1.707612419 * s),
  ])
}

/**
 * The colour, with only its OKLCH lightness changed as little as
 * possible, that reaches `ratio` against every background. Darkens on
 * light backgrounds and lightens on dark ones. Checked on the final hex,
 * so rounding can't push it under.
 */
export function withContrast(color: string, backgrounds: string[], ratio: number): string {
  const passes = (candidate: string) =>
    backgrounds.every((background) => contrast(candidate, background) >= ratio)
  if (passes(color)) return color

  const start = toOklch(color)
  const darken = backgrounds.every((background) => luminance(background) > 0.18)
  // Binary search between the colour and black (or white) for the
  // lightness nearest the original that passes
  let near = start.l
  let far = darken ? 0 : 1
  for (let step = 0; step < 32; step++) {
    const middle = (near + far) / 2
    if (passes(fromOklch({ ...start, l: middle }))) far = middle
    else near = middle
  }
  const found = fromOklch({ ...start, l: far })
  if (passes(found)) return found
  // Out of gamut at that lightness: fall back to black or white
  return darken ? '#000000' : '#ffffff'
}

/**
 * White or near-black text, whichever reads better on `background`.
 * Near-black can fall just short of 4.5:1 on a mid-tone; black or white
 * never does (one of them always reaches √21 ≈ 4.58:1), so it falls
 * back to black.
 */
export function textOn(background: string, dark = '#09090b'): string {
  const white = contrast('#ffffff', background)
  const nearBlack = contrast(dark, background)
  if (Math.max(white, nearBlack) >= 4.5) return white >= nearBlack ? '#ffffff' : dark
  return white >= contrast('#000000', background) ? '#ffffff' : '#000000'
}
