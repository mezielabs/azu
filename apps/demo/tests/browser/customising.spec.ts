import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import Category from '#models/category'
import Order from '#models/order'
import Product from '#models/product'
import { createUser } from '../functional/admin/helpers.ts'
import { axeViolations } from './axe.ts'

/**
 * The README's "Customising" examples (FR-15), in the browser: a field
 * component, a cell component, a slot, and a published page.
 */
test.group('Customising (FR-15)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('SkuInput upper-cases what is typed, and the product saves with it', async ({
    visit,
    browserContext,
    assert,
  }) => {
    await browserContext.loginAs(await createUser('admin'))
    const category = await Category.create({ name: 'Kitchen', slug: 'kitchen-custom' })

    const page = await visit('/admin/resources/products/create')
    const sku = page.getByLabel('SKU', { exact: true })
    await sku.fill('pot-ab12')
    assert.equal(await sku.inputValue(), 'POT-AB12')

    await page.locator('[data-azu-field="name"] input').fill('Clay pot')
    await page.locator('[data-azu-field="price"] input').fill('12.50')
    await page.getByRole('combobox', { name: 'Category' }).fill('Kit')
    await page.locator('.azu-popover [role="option"]', { hasText: 'Kitchen' }).click()
    // Two options render as radio buttons
    await page.locator('[data-azu-field="status"]').getByText('Draft', { exact: true }).click()
    await page.click('form button[type="submit"]')
    await page.waitForURL(/\/admin\/resources\/products\/\d+$/)

    const product = await Product.findByOrFail('sku', 'POT-AB12')
    assert.equal(product.categoryId, category.id)
  })

  test('StockBar renders the stock cell', async ({ visit, browserContext }) => {
    await browserContext.loginAs(await createUser('admin'))
    const category = await Category.create({ name: 'Kitchen', slug: 'kitchen-custom-list' })
    await Product.createMany(
      [
        { name: 'Clay pot', sku: 'CUS-1', stock: 3 },
        { name: 'Steel pan', sku: 'CUS-2', stock: 40 },
      ].map((product) => ({
        ...product,
        categoryId: category.id,
        price: '5.00',
        status: 'draft' as const,
        isFeatured: false,
      }))
    )

    const page = await visit('/admin/resources/products')
    await page
      .getByRole('row', { name: /Clay pot/ })
      .getByText('3 in stock')
      .waitFor()
    await page
      .getByRole('row', { name: /Steel pan/ })
      .getByText('40 in stock')
      .waitFor()
  })

  test("PrintOrder, Orders' toolbar slot, prints the order without the sidebar and actions", async ({
    visit,
    browserContext,
    assert,
  }) => {
    await browserContext.loginAs(await createUser('admin'))
    const customer = await createUser('customer')
    const order = await Order.create({
      userId: customer.id,
      number: 'AZU-PRINT',
      status: 'paid',
      total: '12500.00',
      placedAt: DateTime.now(),
    })

    // On the list the slot renders nothing: printing is for one order
    const page = await visit('/admin/resources/orders')
    await page.getByRole('link', { name: 'AZU-PRINT' }).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Print', exact: true }).count(), 0)

    await page.goto(`/admin/resources/orders/${order.id}`)
    const print = page.locator('.azu-page-actions [data-azu-slot="toolbar"]').getByRole('button', {
      name: 'Print',
      exact: true,
    })
    await print.waitFor()
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      assert.deepEqual(await axeViolations(page), [], `order, ${colorScheme}`)
    }

    // It calls the browser's print
    await page.evaluate(() => {
      const browser = globalThis as any
      browser.printed = 0
      browser.print = () => browser.printed++
    })
    await print.click()
    assert.equal(await page.evaluate(() => (globalThis as any).printed), 1)

    // The print stylesheet keeps the order and drops the shell around it
    await page.emulateMedia({ media: 'print' })
    assert.isFalse(await page.locator('.azu-sidebar').isVisible())
    assert.isFalse(await page.locator('.azu-page-actions').isVisible())
    assert.isTrue(await page.getByRole('heading', { level: 1, name: /AZU-PRINT/ }).isVisible())
    await page.getByRole('region', { name: 'Details' }).getByText('AZU-PRINT').waitFor()
    await page.emulateMedia({ media: 'screen' })
    assert.isTrue(await page.locator('.azu-sidebar').isVisible())
  })

  test('the published dashboard renders instead of the package page', async ({
    visit,
    browserContext,
  }) => {
    await browserContext.loginAs(await createUser('admin'))

    const page = await visit('/admin')
    await page.getByText('Welcome to the Azu demo store.').waitFor()
  })

  test('app components load only on pages that use them, without moving the page', async ({
    visit,
    browserContext,
    assert,
  }) => {
    await browserContext.loginAs(await createUser('admin'))
    const category = await Category.create({ name: 'Kitchen', slug: 'kitchen-custom-lazy' })
    await Product.create({
      categoryId: category.id,
      name: 'Clay pot',
      sku: 'CUS-LAZY',
      price: '5.00',
      stock: 3,
      status: 'draft',
      isFeatured: false,
    })
    const loaded = (page: { evaluate: (fn: () => string[]) => Promise<string[]> }) =>
      page.evaluate(() =>
        (globalThis as any).performance
          .getEntriesByType('resource')
          .map((entry: { name: string }) => entry.name)
          .filter((name: string) => name.includes('/inertia/admin/components/'))
          .map((name: string) => name.split('/').pop()!.split('?')[0])
      )
    const layoutShift = (page: { evaluate: (fn: () => Promise<number>) => Promise<number> }) =>
      page.evaluate(
        () =>
          new Promise<number>((resolve) => {
            new (globalThis as any).PerformanceObserver((list: any) => {
              resolve(
                list
                  .getEntries()
                  .reduce((sum: number, entry: { value: number }) => sum + entry.value, 0)
              )
            }).observe({ type: 'layout-shift', buffered: true })
            setTimeout(() => resolve(0), 500)
          })
      )

    const dashboard = await visit('/admin')
    await dashboard.getByText('Welcome to the Azu demo store.').waitFor()
    assert.deepEqual(await loaded(dashboard), [])

    const list = await visit('/admin/resources/products')
    await list.getByText('3 in stock').waitFor()
    assert.sameMembers(await loaded(list), ['stock_bar.tsx'])
    assert.equal(await list.locator('.azu-cell-loading, .azu-slot-loading').count(), 0)
    assert.isBelow(await layoutShift(list), 0.01)

    const form = await visit('/admin/resources/products/create')
    await form.getByLabel('SKU', { exact: true }).waitFor()
    assert.sameMembers(await loaded(form), ['sku_input.tsx'])
    assert.equal(await form.locator('.azu-placeholder').count(), 0)
    assert.isBelow(await layoutShift(form), 0.01)
  })
})
