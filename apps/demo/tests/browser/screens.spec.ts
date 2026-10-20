import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import Order from '#models/order'
import { createUser } from '../functional/admin/helpers.ts'
import { axeViolations } from './axe.ts'

/** A few orders across the last month, so both screens have rows */
async function orders() {
  const customer = await createUser('customer')
  await Order.createMany(
    [1, 30, 200, 500].map((hours, index) => ({
      userId: customer.id,
      number: `AZU-SCR-${index}`,
      status: 'paid' as const,
      total: '1500.25',
      placedAt: DateTime.now().minus({ hours }),
    }))
  )
}

/**
 * Custom screens, links and the home screen in the browser (FR-20 to
 * FR-22): the demo's Overview and Sales report.
 */
test.group('Screens', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('admins land on Overview, open the Sales report and switch its range', async ({
    visit,
    browserContext,
    assert,
  }) => {
    await orders()
    await browserContext.loginAs(await createUser('admin'))
    const page = await visit('/admin')

    // The home screen, at /admin, first in the navigation
    await page.getByRole('heading', { level: 1, name: 'Overview' }).waitFor()
    // Ungrouped: no breadcrumb repeating the title
    assert.equal(await page.getByRole('navigation', { name: 'Breadcrumb' }).count(), 0)
    assert.match(page.url(), /\/admin$/)
    const sidebar = page.locator('.azu-sidebar')
    assert.equal(
      await sidebar.getByRole('link', { name: 'Overview' }).getAttribute('aria-current'),
      'page'
    )
    const counts = page.getByRole('list', { name: 'Store at a glance' })
    await counts.getByText('Orders today', { exact: true }).waitFor()
    // Each count links to the list it counts
    await counts.getByRole('link', { name: /See them\s*: orders today/ }).click()
    await page.waitForURL(/\/admin\/resources\/orders\?placedAt=/)
    await page.goBack()

    await sidebar.getByRole('link', { name: 'Sales report' }).click()
    await page.waitForURL('**/admin/screens/sales-report')
    await page.getByRole('heading', { level: 1, name: 'Sales report' }).waitFor()
    await page.getByRole('navigation', { name: 'Breadcrumb' }).getByText('Reports').waitFor()
    const rows = page.locator('[data-sales-report] tbody tr')
    assert.equal(await rows.count(), 7)

    // Switching the range reloads only the screen's data
    const reload = page.waitForRequest((request) => request.url().includes('days=30'))
    await page.getByRole('button', { name: '30 days' }).click()
    const request = await reload
    assert.equal(request.headers()['x-inertia-partial-data'], 'data')
    await page.waitForURL(/days=30/)
    await page.getByRole('button', { name: '30 days', pressed: true }).waitFor()
    assert.equal(await rows.count(), 30)
    assert.equal(
      await sidebar.getByRole('link', { name: 'Sales report' }).getAttribute('aria-current'),
      'page'
    )
  })

  test('staff see no Reports group, and the external link opens a new tab', async ({
    visit,
    browserContext,
    assert,
  }) => {
    await browserContext.loginAs(await createUser('staff'))
    const page = await visit('/admin')
    const sidebar = page.locator('.azu-sidebar')
    await sidebar.getByRole('link', { name: 'Overview' }).waitFor()
    assert.notInclude(await sidebar.locator('.azu-nav-heading').allInnerTexts(), 'REPORTS')
    assert.equal(await sidebar.getByRole('link', { name: 'Sales report' }).count(), 0)

    const docs = sidebar.getByRole('link', { name: /Azu documentation/ })
    assert.equal(await docs.getAttribute('target'), '_blank')
    assert.equal(await docs.getAttribute('rel'), 'noopener')
    assert.equal(await docs.getAttribute('href'), 'https://github.com/mezielabs/azu#readme')
    // Named for screen readers, with the new tab said
    const text = await docs.innerText()
    assert.equal(text.replace(/\s+/g, ' ').trim(), 'Azu documentation (opens in a new tab)')
  })

  test('Overview and the Sales report pass axe in both themes, desktop and phone', async ({
    visit,
    browserContext,
    assert,
  }) => {
    await orders()
    await browserContext.loginAs(await createUser('admin'))
    const page = await visit('/admin')
    for (const [width, height] of [
      [1440, 900],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height })
      for (const url of ['/admin', '/admin/screens/sales-report']) {
        await page.goto(url)
        await page.locator('.azu-screen').waitFor()
        for (const colorScheme of ['light', 'dark'] as const) {
          await page.emulateMedia({ colorScheme })
          assert.deepEqual(await axeViolations(page), [], `${url} at ${width}px, ${colorScheme}`)
        }
      }
    }
  })
})
