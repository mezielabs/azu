import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { createUser } from '../functional/admin/helpers.ts'

/**
 * Navigation icons and order (FR-16): each resource's Lucide icon,
 * decorative, in the order config/azu.ts and the resources set.
 */
test.group('Navigation (FR-16)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('links show their icons, hidden from screen readers, in order', async ({
    visit,
    browserContext,
    assert,
  }) => {
    await browserContext.loginAs(await createUser('admin'))
    const page = await visit('/admin')
    await page.waitForSelector('.azu-sidebar .azu-nav-link svg')
    const sidebar = page.locator('.azu-sidebar')

    // The home screen comes first (FR-22): Overview, with its icon
    await sidebar.getByRole('link', { name: 'Overview' }).waitFor()
    const links = await sidebar.locator('.azu-nav-group .azu-nav-link').evaluateAll((elements) =>
      elements.map((link: any) => {
        const svg = link.querySelector('svg')
        return {
          text: link.textContent.trim(),
          icon: link.getAttribute('data-azu-icon'),
          svgHidden: svg?.getAttribute('aria-hidden') ?? null,
          lucide: svg?.classList.contains('lucide') ?? false,
        }
      })
    )
    assert.deepEqual(links, [
      { text: 'Orders', icon: 'receipt', svgHidden: 'true', lucide: true },
      { text: 'Awaiting shipping', icon: 'truck', svgHidden: 'true', lucide: true },
      { text: 'Coupons', icon: 'ticket', svgHidden: 'true', lucide: true },
      { text: 'Products', icon: 'package', svgHidden: 'true', lucide: true },
      { text: 'Categories', icon: 'folder', svgHidden: 'true', lucide: true },
      { text: 'Tags', icon: 'tag', svgHidden: 'true', lucide: true },
      { text: 'Sales report', icon: 'chart-column', svgHidden: 'true', lucide: true },
      { text: 'Store settings', icon: 'settings', svgHidden: 'true', lucide: true },
      // An external link (FR-21): its own icon, then the new-tab one
      {
        text: 'Azu documentation (opens in a new tab)',
        icon: 'book-open',
        svgHidden: 'true',
        lucide: true,
      },
    ])
    assert.deepEqual(await sidebar.locator('.azu-nav-heading').allInnerTexts(), [
      'SALES',
      'CATALOG',
      'REPORTS',
      'SETTINGS',
      'HELP',
    ])
  })
})
