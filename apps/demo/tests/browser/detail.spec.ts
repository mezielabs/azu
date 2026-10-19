import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import drive from '@adonisjs/drive/services/main'
import { DateTime } from 'luxon'
import Category from '#models/category'
import Order from '#models/order'
import Product from '#models/product'
import { createUser } from '../functional/admin/helpers.ts'
import { axeViolations } from './axe.ts'

const TILE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#15803d"/></svg>'

async function product() {
  const category = await Category.create({ name: 'Books', slug: 'books-detail-ui' })
  await drive.use().put('detail-ui/lagos-noir.svg', TILE)
  const record = await Product.create({
    categoryId: category.id,
    name: 'Lagos Noir',
    sku: 'SKU-DETAIL',
    price: '11250.00',
    stock: 23,
    status: 'published',
    isFeatured: false,
    thumbnail: 'detail-ui/lagos-noir.svg',
    description: '<p>Twelve stories set between Yaba and the Island.</p>',
  })
  return { category, record }
}

/**
 * The detail page (layout 3/4): two columns, column formatting, the
 * Record card, Delete in a "⋯" menu, hasMany cards, and the columns
 * when a resource has no fields.
 */
test.group('Detail page', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('fields on the left with column formatting; media and the record on the right', async ({
    visit,
    browserContext,
    assert,
  }) => {
    await browserContext.loginAs(await createUser('admin'))
    const { record } = await product()
    const page = await visit(`/admin/resources/products/${record.id}`)

    // The status badge sits beside the title, and leaves the Details list
    await page.locator('h1 .azu-title-badge').getByText('Published').waitFor()
    const details = page.getByRole('region', { name: 'Details' })
    await details.getByText('NGN 11,250.00').waitFor()
    assert.equal(await details.locator('dt', { hasText: /^Status$/ }).count(), 0)
    assert.equal(await details.locator('dt', { hasText: /^Thumbnail$/ }).count(), 0)

    const thumbnail = page.getByRole('region', { name: 'Thumbnail' })
    await thumbnail.getByRole('img', { name: /Thumbnail: lagos-noir\.svg/ }).waitFor()
    await thumbnail.getByRole('link', { name: 'lagos-noir.svg · Open full size' }).waitFor()

    const facts = page.getByRole('region', { name: 'Record' })
    await facts.getByText(String(record.id), { exact: true }).waitFor()
    await facts.getByText('Created').waitFor()
    await facts.getByText('Updated').waitFor()

    // The two columns sit side by side at 1280px
    const main = (await page.locator('.azu-detail-main').boundingBox())!
    const side = (await page.locator('.azu-detail-side').boundingBox())!
    assert.isAbove(side.x, main.x + main.width - 1)

    // Restock stays a button; Delete moves into the "⋯" menu
    await page.getByRole('button', { name: 'Restock' }).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Delete', exact: true }).count(), 0)
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      assert.deepEqual(await axeViolations(page), [], `detail, ${colorScheme}`)
    }
    await page.getByRole('button', { name: 'More actions' }).click()
    await page.getByRole('menu').getByRole('menuitem', { name: 'Delete' }).waitFor()
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      assert.deepEqual(await axeViolations(page, { popoverOpen: true }), [], `menu, ${colorScheme}`)
    }
  })

  test('hasMany tables are cards below, with their count', async ({
    visit,
    browserContext,
    assert,
  }) => {
    await browserContext.loginAs(await createUser('admin'))
    const { category } = await product()
    const page = await visit(`/admin/resources/categories/${category.id}`)

    const table = page.locator('[data-azu-relation="products"]')
    await table.getByRole('heading', { name: /^Products/ }).waitFor()
    const count = await table.locator('.azu-panel-count').innerText()
    assert.equal(count.trim(), '· 1')
    await table.getByRole('link', { name: 'Lagos Noir' }).waitFor()
    // Every row's category is this one: no Category column
    await table.getByRole('columnheader', { name: 'Name' }).waitFor()
    assert.equal(await table.getByRole('columnheader', { name: 'Category' }).count(), 0)
  })

  test('with no fields (Orders), the columns show instead', async ({
    visit,
    browserContext,
    assert,
  }) => {
    await browserContext.loginAs(await createUser('admin'))
    const customer = await createUser('customer')
    const order = await Order.create({
      userId: customer.id,
      number: 'AZU-1020',
      status: 'shipped',
      total: '22500.00',
      placedAt: DateTime.now(),
    })
    const page = await visit(`/admin/resources/orders/${order.id}`)

    await page.locator('h1 .azu-title-badge').getByText('Shipped').waitFor()
    const details = page.getByRole('region', { name: 'Details' })
    await details.getByText('AZU-1020').waitFor()
    await details.getByText('NGN 22,500.00').waitFor()
    await details.getByText(customer.email).waitFor()
    assert.equal(await details.locator('dt', { hasText: /^Status$/ }).count(), 0)
  })

  test('below 768px the side column stacks under the details', async ({
    visit,
    browserContext,
    assert,
  }) => {
    await browserContext.loginAs(await createUser('admin'))
    const { record } = await product()
    const page = await visit(`/admin/resources/products/${record.id}`)
    await page.setViewportSize({ width: 390, height: 844 })

    const main = (await page.locator('.azu-detail-main').boundingBox())!
    const side = (await page.locator('.azu-detail-side').boundingBox())!
    assert.isAtLeast(side.y, main.y + main.height - 1)
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      assert.deepEqual(await axeViolations(page), [], `phone detail, ${colorScheme}`)
    }
  })
})
