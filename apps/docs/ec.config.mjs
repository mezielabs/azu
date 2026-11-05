// @ts-check
import { defineEcConfig, ExpressiveCodeTheme } from '@astrojs/starlight/expressive-code'
// Imported, not read from disk: Astro bundles this file for <Code>, where a
// path relative to import.meta.url points into the build output
import azuThemeJson from './src/styles/azu-code-theme.json' with { type: 'json' }

/**
 * Expressive Code's config for the docs: here rather than in astro.config.mjs
 * because a theme object isn't serialisable, and Starlight's <Code> component
 * (which DemoCode uses) reads this file. Expressive Code merges it with the
 * integration options.
 *
 * One dark theme for both site themes, so code reads as code on either page.
 * Every token colour is at least 4.5:1 on its background (docs/decisions.md).
 */
const azuTheme = new ExpressiveCodeTheme(azuThemeJson)

export default defineEcConfig({
  themes: [azuTheme],
  // Wrap rather than scroll: a scrolling block can't be reached by keyboard
  // (axe: scrollable-region-focusable), and wrapped code reads better on
  // phones. Wrapped lines keep their indent, plus two columns.
  defaultProps: { wrap: true, preserveIndent: true, hangingIndent: 2 },
  styleOverrides: {
    // Diff lines: green and red tints, with the + and - markers carrying the
    // meaning. Plain text is 12:1 or more on both, the markers 7:1 or more.
    // Marked lines (`mark=`) in a dark Clay tint rather than the default
    // blue: every token is 5.5:1 or more on it.
    textMarkers: {
      markBackground: '#2f1c15',
      markBorderColor: '#e47a57',
      insBackground: '#1d3324',
      insBorderColor: '#7fd18e',
      insDiffIndicatorColor: '#7fd18e',
      delBackground: '#3a1d1a',
      delBorderColor: '#f29a8f',
      delDiffIndicatorColor: '#f29a8f',
    },
  },
})
