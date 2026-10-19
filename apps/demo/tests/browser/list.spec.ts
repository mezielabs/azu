import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { action } from '@mezielabs/azu'
import { DateTime } from 'luxon'
import productResource from '#admin/resources/product_resource'
import Category from '#models/category'
import Order from '#models/order'
import Product from '#models/product'
import { createUser } from '../functional/admin/helpers.ts'
import { axeViolations } from './axe.ts'

async function catalog() {
  const kitchen = await Category.create({ name: 'Kitchen', slug: 'kitchen-list-ui' })
  const rows = Array.from({ length: 30 }, (_, index) => ({
    categoryId: kitchen.id,
    name: `Pot ${String(index + 1).padStart(2, '0')}`,
    sku: `LIST-${index + 1}`,
    price: '5.00',
    stock: 20,
    status: (index % 3 === 0 ? 'draft' : 'published') as 'draft' | 'published',
    isFeatured: false,
  }))
  await Product.createMany(rows)
  return kitchen
}

/**
 * The list page (layout 2/4): one card with the controls or the bulk
 * bar, a summary strip, the table and a footer; cards and a filters
 * sheet below 768px.
 */
test.group('List page', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('filters are buttons, the summary says what is shown, and titles link', async ({
    visit,
    browserContext,
    assert,
  }) => {
    await browserContext.loginAs(await createUser('admin'))
    await catalog()
    const page = await visit('/admin/resources/products')
    const list = page.getByRole('region', { name: 'Products' })
    const summary = list.locator('.azu-list-summary')

    await summary.getByText('30 products').waitFor()
    // The title shows the count too
    assert.include(await page.getByRole('heading', { level: 1 }).innerText(), '30')

    // Status: a popover with its select; the button is then tinted and says the value
    await list.getByRole('button', { name: 'Status' }).click()
    await page
      .getByRole('dialog', { name: 'Filter by Status' })
      .getByLabel('Status')
      .selectOption('published')
    await page.waitForURL(/status=published/)
    const status = list.getByRole('button', { name: 'Status Published' })
    await status.waitFor()
    assert.equal(await status.getAttribute('data-azu-active'), 'true')
    await summary.getByText('20 of 30 products · filtered by Status: Published').waitFor()

    // An on/off filter is a toggle
    const lowStock = list.getByRole('button', { name: 'Low stock' })
    assert.equal(await lowStock.getAttribute('aria-pressed'), 'false')

    await list.getByRole('button', { name: 'Clear filters' }).click()
    await summary.getByText('30 products').waitFor()

    // Cells: a status label, an image placeholder, a sort hint, a real title link
    const row = page.getByRole('row', { name: /Pot 30/ })
    await row.getByText('Published', { exact: true }).waitFor()
    assert.equal(await row.locator('.azu-thumbnail-empty').count(), 1)
    assert.isAbove(await page.locator('.azu-th .azu-sort-indicator').count(), 0)
    assert.equal(await row.locator('.azu-row-actions-button.azu-button').count(), 0)
    await row.getByRole('link', { name: 'Pot 30' }).click()
    await page.waitForURL(/\/admin\/resources\/products\/\d+$/)
  })

  test('selecting rows swaps the controls for the bulk bar, at the same height', async ({
    visit,
    browserContext,
    assert,
  }) => {
    await browserContext.loginAs(await createUser('admin'))
    await catalog()
    const page = await visit('/admin/resources/products')
    const controls = page.locator('.azu-list-controls')
    const before = (await controls.boundingBox())!.height
    const tableTop = (await page.locator('.azu-table-container').boundingBox())!.y

    await page
      .locator('.azu-checkbox', { has: page.getByRole('checkbox', { name: /Pot 30/ }) })
      .click()
    const bar = page.getByRole('toolbar', { name: 'Bulk actions' })
    await bar.getByText('1 selected').waitFor()
    assert.equal(await controls.count(), 0)
    assert.equal(Math.round((await bar.boundingBox())!.height), Math.round(before))
    assert.equal((await page.locator('.azu-table-container').boundingBox())!.y, tableTop)

    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      assert.deepEqual(await axeViolations(page), [], `bulk bar, ${colorScheme}`)
    }

    await bar.getByRole('button', { name: 'Clear selection' }).click()
    await page.locator('.azu-list-controls').waitFor()
  })

  test('the footer has rows per page and page numbers', async ({ visit, browserContext }) => {
    await browserContext.loginAs(await createUser('admin'))
    await catalog()
    const page = await visit('/admin/resources/products?perPage=10')
    const footer = page.locator('.azu-list-footer')

    await footer.getByText('Showing').waitFor()
    await footer.getByRole('button', { name: 'Page 2' }).click()
    await page.waitForURL(/page=2/)
    await footer
      .getByRole('button', { name: 'Page 2' })
      .and(page.locator('[aria-current="page"]'))
      .waitFor()

    await footer.getByLabel('Rows per page').selectOption('25')
    await page.waitForURL((url) => !url.search.includes('perPage=10'))
  })

  test('below 768px, rows are cards and filters open in a sheet', async ({
    visit,
    browserContext,
    assert,
  }) => {
    await browserContext.loginAs(await createUser('admin'))
    await catalog()
    const page = await visit('/admin/resources/products')
    await page.setViewportSize({ width: 390, height: 844 })

    const cards = page.locator('.azu-list-cards')
    await cards.waitFor()
    assert.equal(await page.locator('.azu-table-container').count(), 0)
    await cards.getByRole('link', { name: /Pot 30/ }).waitFor()

    // The New button is a 44px icon button with its name for screen readers
    const create = page.getByRole('link', { name: 'New product' })
    assert.isAtLeast(Math.round((await create.boundingBox())!.height), 44)

    await page.getByRole('button', { name: 'Filters' }).click()
    const sheet = page.getByRole('dialog', { name: 'Filter products' })
    // A date range is two labelled inputs; toggles are 44px rows with a gap
    await sheet.getByLabel('From', { exact: true }).waitFor()
    await sheet.getByLabel('To', { exact: true }).waitFor()
    const toggles = await sheet.locator('.azu-filter-toggle').evaluateAll((elements) =>
      elements.map((element: any) => ({
        height: Math.round(element.getBoundingClientRect().height),
        gap: Number.parseFloat((globalThis as any).getComputedStyle(element).columnGap),
      }))
    )
    assert.isAbove(toggles.length, 0)
    assert.isTrue(toggles.every((toggle) => toggle.height >= 44 && toggle.gap >= 12))
    await sheet.getByLabel('Status').selectOption('draft')
    await page.waitForURL(/status=draft/)
    await page.getByRole('button', { name: 'Filters · 1' }).waitFor()

    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      assert.deepEqual(await axeViolations(page), [], `filters sheet, ${colorScheme}`)
    }

    await sheet.getByRole('button', { name: 'Done' }).click()
    await sheet.waitFor({ state: 'detached' })
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      assert.deepEqual(await axeViolations(page), [], `cards, ${colorScheme}`)
    }
  })

  test("the Orders list shows its status filter's labels", async ({ visit, browserContext }) => {
    await browserContext.loginAs(await createUser('admin'))
    const customer = await createUser('customer')
    await Order.create({
      userId: customer.id,
      number: 'LIST-SHIPPED',
      status: 'shipped',
      total: '10.00',
      placedAt: DateTime.now(),
    })

    const page = await visit('/admin/resources/orders')
    await page
      .getByRole('row', { name: /LIST-SHIPPED/ })
      .getByText('Shipped', { exact: true })
      .waitFor()
  })

  test('an empty list names the search and filters, offers Clear, and keeps its columns', async ({
    visit,
    browserContext,
    assert,
  }) => {
    await browserContext.loginAs(await createUser('admin'))
    await catalog()
    const page = await visit('/admin/resources/products')
    await page.setViewportSize({ width: 1440, height: 900 })
    const firstRow = page.locator('.azu-table tbody .azu-title-link').first()
    await firstRow.waitFor()
    const headers = () =>
      page
        .locator('.azu-table thead th')
        .evaluateAll((cells: any[]) =>
          cells.map((cell) => Math.round(cell.getBoundingClientRect().width))
        )
    const before = await headers()

    // A search that matches nothing
    await page.getByRole('searchbox', { name: 'Search products' }).fill('zzz')
    const empty = page.locator('.azu-table-empty')
    await empty.getByText('No products match “zzz”', { exact: true }).waitFor()
    assert.deepEqual(await headers(), before, 'the columns keep their widths')
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      assert.deepEqual(await axeViolations(page), [], `empty list, ${colorScheme}`)
    }

    // Clear brings the rows back and empties the search box
    await empty.getByRole('button', { name: 'Clear search' }).click()
    await firstRow.waitFor()
    assert.equal(await page.getByRole('searchbox', { name: 'Search products' }).inputValue(), '')
    assert.notInclude(page.url(), 'search=')

    // Filters and a search together, straight from a URL
    await page.goto('/admin/resources/products?status=draft&search=Pot%2002')
    await empty
      .getByText('No products match “Pot 02” with Status: Draft', { exact: true })
      .waitFor()
    await empty.getByRole('button', { name: 'Clear search and filters' }).click()
    await firstRow.waitFor()
    assert.notInclude(page.url(), 'status=')

    // Phone cards say the same
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/admin/resources/products?search=zzz')
    await page
      .locator('.azu-list-cards')
      .getByText('No products match “zzz”', { exact: true })
      .waitFor()
    await page.getByRole('button', { name: 'Clear search' }).click()
    await page.locator('.azu-card').first().waitFor()
  })

  test('six bulk actions: the bar keeps one line and one height at 1440px and 900px', async ({
    visit,
    browserContext,
    assert,
    cleanup,
  }) => {
    // Three more bulk actions for this test: publish, feature, archive, export, purge, delete
    const declared = productResource.actions()
    const extra = [
      action.bulk('archive').handle(async () => {}),
      action.bulk('export').handle(async () => {}),
      action
        .bulk('purge')
        .destructive()
        .handle(async () => {}),
    ]
    const last = declared.at(-1)!
    const all = [...declared.slice(0, -1), ...extra, last]
    productResource.actions = () => all as never
    cleanup(() => {
      delete (productResource as { actions?: unknown }).actions
    })

    await browserContext.loginAs(await createUser('admin'))
    await catalog()
    const page = await visit('/admin/resources/products')

    const oneLine = async (width: number) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/admin/resources/products')
      const controls = page.locator('.azu-list-controls')
      await controls.waitFor()
      const height = (await controls.boundingBox())!.height
      const tableTop = (await page.locator('.azu-table-container').boundingBox())!.y

      await page
        .locator('.azu-checkbox', { has: page.getByRole('checkbox', { name: 'Select All' }) })
        .click()
      const bar = page.getByRole('toolbar', { name: 'Bulk actions' })
      await bar.waitFor()
      assert.equal(Math.round((await bar.boundingBox())!.height), Math.round(height), `${width}px`)
      assert.equal((await page.locator('.azu-table-container').boundingBox())!.y, tableTop)
      // Nothing wraps or spills: every item on one line, inside the bar
      const layout = await bar.evaluate((element: any) => ({
        tops: [...element.children].map((child: any) =>
          Math.round(child.getBoundingClientRect().top + child.getBoundingClientRect().height / 2)
        ),
        overflows: element.scrollWidth > element.clientWidth,
      }))
      assert.equal(new Set(layout.tops.filter((top: number) => top > 0)).size, 1, `${width}px`)
      assert.isFalse(layout.overflows, `${width}px`)
      return bar
    }

    const menuAxe = async (width: number) => {
      for (const colorScheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme })
        assert.deepEqual(
          await axeViolations(page, { popoverOpen: true }),
          [],
          `${width}px menu, ${colorScheme}`
        )
      }
    }

    const wide = await oneLine(1440)
    assert.deepEqual(await wide.locator('.azu-bulk-action:not(.azu-bulk-menu)').allInnerTexts(), [
      'Publish',
      'Feature',
    ])
    await wide.getByRole('button', { name: 'More' }).click()
    const more = page.getByRole('menu', { name: 'More' })
    assert.deepEqual(await more.getByRole('menuitem').allInnerTexts(), [
      'Archive',
      'Export',
      'Purge',
      'Delete',
    ])
    // Destructive ones last, in danger style
    assert.deepEqual(await more.locator('.azu-is-destructive').allInnerTexts(), ['Purge', 'Delete'])
    await menuAxe(1440)
    await page.keyboard.press('Escape')
    await more.waitFor({ state: 'detached' })

    const narrow = await oneLine(900)
    assert.equal(await narrow.locator('.azu-bulk-action:not(.azu-bulk-menu)').count(), 0)
    await narrow.getByRole('button', { name: 'Actions' }).click()
    assert.deepEqual(
      await page.getByRole('menu', { name: 'Actions' }).getByRole('menuitem').allInnerTexts(),
      ['Publish', 'Feature', 'Archive', 'Export', 'Purge', 'Delete']
    )
    await menuAxe(900)
  })
})
