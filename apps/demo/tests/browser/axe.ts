import { createRequire } from 'node:module'
import type { Page } from 'playwright'

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js')
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

/**
 * The page's axe violations against WCAG 2.1 A and AA (spec §10), one
 * line each, so a failing assertion says what and where.
 *
 * `popoverOpen` is for scans taken while a React Aria popover is open:
 * a combobox's options, a menu, a date picker's calendar. React Aria
 * then hides everything outside the popover from screen readers with
 * `aria-hidden`, not `inert`, so the page still takes the click outside
 * that closes the popover. axe's `aria-hidden-focus` flags the focusable
 * elements under that `aria-hidden`. They're never focused while hidden:
 * Tab moves focus out of the popover and closes it, which removes the
 * `aria-hidden`. React Aria has no option to change this, so that one
 * rule is off for these scans and only these; every other rule runs,
 * and closed-state scans run them all (docs/decisions.md).
 */
export async function axeViolations(
  page: Page,
  options: { popoverOpen?: boolean } = {}
): Promise<string[]> {
  const popoverOpen = options.popoverOpen === true
  // The exception only applies while a popover really is open
  if (popoverOpen && (await page.locator('.azu-popover').count()) === 0) {
    throw new Error('axeViolations({ popoverOpen: true }) with no popover open')
  }
  await page.addScriptTag({ path: AXE })
  return page.evaluate(
    async ({ tags, skipHiddenFocus }) => {
      // Runs in the page; the server's tsconfig has no DOM types
      const { axe, document } = globalThis as unknown as { axe: any; document: unknown }
      const result = await axe.run(document, {
        runOnly: { type: 'tag', values: tags },
        rules: skipHiddenFocus ? { 'aria-hidden-focus': { enabled: false } } : {},
      })
      return result.violations.map(
        (violation: { id: string; impact: string; nodes: { target: string[] }[] }) =>
          `${violation.id} (${violation.impact}): ${violation.nodes
            .slice(0, 3)
            .map((node) => node.target.join(' '))
            .join(', ')}`
      )
    },
    { tags: WCAG, skipHiddenFocus: popoverOpen }
  )
}
