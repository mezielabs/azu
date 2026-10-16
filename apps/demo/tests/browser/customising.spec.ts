import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Category from '#models/category'
import Product from '#models/product'
import { createUser } from '../functional/admin/helpers.ts'

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
    const sku = page.getByLabel('Sku', { exact: true })
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

  test('StockBar renders the stock cell, and the beforeTable slot links to the filter', async ({
    visit,
    browserContext,
    assert,
  }) => {
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

    const notice = page.locator('[data-azu-slot="beforeTable"]')
    await notice.getByRole('link', { name: 'Show products with fewer than 10 in stock' }).click()
    await page.waitForURL(/low-stock=1/)
    await page.getByRole('row', { name: /Steel pan/ }).waitFor({ state: 'detached' })
    assert.equal(await page.getByRole('row', { name: /Clay pot/ }).count(), 1)
  })

  test('the published dashboard renders instead of the package page', async ({
    visit,
    browserContext,
  }) => {
    await browserContext.loginAs(await createUser('admin'))

    const page = await visit('/admin')
    await page.getByText('Welcome to the Azu demo store.').waitFor()
  })
})
