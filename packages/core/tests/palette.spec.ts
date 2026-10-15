import { test } from '@japa/runner'
import { contrast, fromOklch, isHexColor, parseHex, textOn, toOklch } from '../src/theme/color.ts'
import { BADGE_COLORS, palette, themeCss, type ThemeName } from '../src/theme/palette.ts'

/**
 * Brand colours across the range, including very light and very dark
 * ones that can't be used as they are on one theme or the other.
 */
const BRANDS = [
  '#2563eb', // the default blue
  '#ffffff', // white
  '#fefce8', // near-white yellow
  '#ffff00', // bright yellow
  '#00ff00', // bright green
  '#ff0000', // red
  '#f97316', // orange
  '#14b8a6', // teal
  '#7c3aed', // violet
  '#ec4899', // pink
  '#808080', // mid grey
  '#1e1b4b', // very dark indigo
  '#0a0a0a', // near-black
  '#000000', // black
  '#abc', // shorthand
]

/** Text and the backgrounds it sits on, by token */
function textPairs(): [string, string][] {
  return [
    ['text', 'surface'],
    ['text', 'subtle'],
    ['muted', 'surface'],
    ['muted', 'subtle'],
    ['brand', 'surface'],
    ['brand', 'subtle'],
    ['on-brand', 'brand-solid'],
    ['danger', 'surface'],
    ['danger', 'subtle'],
    ['danger', 'danger-subtle'],
    ['on-danger', 'danger-solid'],
    ...BADGE_COLORS.map((color): [string, string] => [`badge-${color}-text`, `badge-${color}-bg`]),
  ]
}

test.group('Generated palettes (FR-14)', () => {
  for (const theme of ['light', 'dark'] as ThemeName[]) {
    test(`every text pair reaches 4.5:1 in the ${theme} theme, for every brand colour`, ({
      assert,
    }) => {
      const failures: string[] = []
      for (const brand of BRANDS) {
        const tokens = palette(brand, theme)
        for (const [text, background] of textPairs()) {
          const ratio = contrast(tokens[text], tokens[background])
          if (ratio < 4.5) {
            failures.push(`${brand}: ${text} on ${background} is ${ratio.toFixed(2)}:1`)
          }
        }
        // Focus rings and the success stripe are non-text: 3:1
        for (const accent of ['brand', 'success']) {
          if (contrast(tokens[accent], tokens.surface) < 3) {
            failures.push(`${brand}: ${accent} on surface is under 3:1`)
          }
        }
      }
      assert.deepEqual(failures, [])
    })
  }

  test('a brand colour that already passes is used as it is', ({ assert }) => {
    assert.equal(palette('#2563eb', 'light').brand, '#2563eb')
    assert.equal(palette('#1e1b4b', 'light').brand, '#1e1b4b')
  })

  test('adjusting a brand colour changes its lightness and keeps its hue', ({ assert }) => {
    for (const [brand, theme] of [
      ['#2563eb', 'dark'],
      ['#ffff00', 'light'],
      ['#14b8a6', 'light'],
      ['#7c3aed', 'dark'],
    ] as [string, ThemeName][]) {
      const before = toOklch(brand)
      const after = toOklch(palette(brand, theme).brand)
      assert.notEqual(palette(brand, theme).brand, brand)
      assert.isBelow(Math.abs(after.h - before.h), 0.15, `${brand} ${theme} hue`)
      assert.equal(after.l > before.l, theme === 'dark', `${brand} ${theme} lightness`)
    }
  })

  test('text on a filled brand area is white or near-black, whichever reads', ({ assert }) => {
    assert.equal(textOn('#2563eb'), '#ffffff')
    assert.equal(textOn('#fde047'), '#09090b')
    // Near-black falls short on some mid-tones; black never does
    for (let grey = 0; grey <= 255; grey += 5) {
      const background = `#${grey.toString(16).padStart(2, '0').repeat(3)}`
      assert.isAtLeast(contrast(textOn(background), background), 4.5, background)
    }
  })

  test('OKLCH round-trips sRGB', ({ assert }) => {
    for (const color of ['#2563eb', '#ffffff', '#000000', '#14b8a6', '#ff0000']) {
      const [r, g, b] = parseHex(fromOklch(toOklch(color)))
      const [er, eg, eb] = parseHex(color)
      assert.isAtMost(Math.max(Math.abs(r - er), Math.abs(g - eg), Math.abs(b - eb)), 1, color)
    }
    assert.isTrue(isHexColor('#abc'))
    assert.isFalse(isHexColor('blue'))
  })

  test('the CSS follows the OS, then the stored choice', ({ assert }) => {
    const css = themeCss('#2563eb')
    assert.include(css, ':root{color-scheme:light;--azu-surface:#ffffff;')
    assert.include(
      css,
      '@media (prefers-color-scheme: dark){:root:not([data-azu-theme="light"]){color-scheme:dark;'
    )
    assert.include(css, ':root[data-azu-theme="dark"]{color-scheme:dark;')
    assert.include(css, '--azu-brand:#2563eb;')
  })
})
