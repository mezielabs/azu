import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Category from '#models/category'
import Product from '#models/product'
import { createUser } from '../functional/admin/helpers.ts'
import { axeViolations } from './axe.ts'

async function catalog() {
  const category = await Category.create({ name: 'Kitchen', slug: 'mobile-workflows' })
  const other = await Category.create({ name: 'Garden', slug: 'mobile-other' })
  for (let index = 1; index <= 12; index++) {
    await Product.create({
      categoryId: index === 12 ? other.id : category.id,
      name: `Pot ${String(index).padStart(2, '0')}`,
      sku: `MOBILE-${index}`,
      price: '5.00',
      stock: 3,
      status: 'draft',
      isFeatured: false,
    })
  }
  return category
}

test.group('Mobile list workflows', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('sorts, selects, clears, pages and runs a filtered all-matching action', async ({
    visit,
    browserContext,
    assert,
  }) => {
    const category = await catalog()
    await browserContext.loginAs(await createUser('admin'))
    const page = await visit(
      `/admin/resources/products?category=${category.id}&search=Pot&perPage=10`
    )
    await page.setViewportSize({ width: 390, height: 844 })
    const cards = page.getByRole('list', { name: 'Products', exact: true })
    await page.getByLabel('Sort by', { exact: true }).selectOption('name:asc')
    await page.waitForURL(/sort=name/)
    assert.include(page.url(), `category=${category.id}`)
    assert.include(page.url(), 'search=Pot')
    assert.equal(await cards.locator('.azu-card-title').first().innerText(), 'Pot 01')
    await page.getByRole('button', { name: 'Select records', exact: true }).click()
    const checkbox = cards.getByRole('checkbox', { name: 'Select Pot 01', exact: true })
    await checkbox.focus()
    await checkbox.press('Space')
    const summary = page.locator('[data-azu-selection-status]')
    await summary.filter({ hasText: '1 selected' }).waitFor()
    assert.equal(await cards.getByRole('link').count(), 0)
    await page.getByRole('button', { name: 'Done selecting', exact: true }).click()
    assert.equal(await cards.getByRole('checkbox').count(), 0)
    assert.isAbove(await cards.getByRole('link').count(), 0)
    assert.equal(await summary.textContent(), '')

    await page.getByRole('button', { name: 'Select records', exact: true }).click()
    await page.getByRole('button', { name: 'Select this page', exact: true }).click()
    await page.getByRole('button', { name: 'Clear selection', exact: true }).click()
    await page.getByRole('button', { name: 'Select records', exact: true }).waitFor()
    await page.getByRole('button', { name: 'Select records', exact: true }).click()
    await page.getByRole('button', { name: 'Select this page', exact: true }).click()
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await page.waitForURL(/page=2/)
    await page.getByRole('button', { name: 'Select records', exact: true }).waitFor()
    assert.equal(await summary.textContent(), '')
    await page.getByLabel('Sort by', { exact: true }).selectOption('name:desc')
    await page.waitForURL(/direction=desc/)
    assert.notInclude(page.url(), 'page=2')
    assert.equal(await cards.locator('.azu-card-title').first().innerText(), 'Pot 11')
    await page.getByRole('button', { name: 'Select records', exact: true }).click()
    await page.getByRole('button', { name: 'Select this page', exact: true }).click()
    const toolbar = page.getByRole('toolbar', { name: 'Bulk actions' })
    await toolbar.getByRole('button', { name: 'Select all 11 matching', exact: true }).click()
    await summary.filter({ hasText: 'All 11 matching selected' }).waitFor()
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      assert.deepEqual(await axeViolations(page), [])
    }
    await toolbar.getByRole('button', { name: 'Actions', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Delete', exact: true }).click()
    const dialog = page.getByRole('alertdialog')
    assert.include(await dialog.innerText(), 'all 11 matching products')
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await toolbar.getByRole('button', { name: 'Actions', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Publish', exact: true }).click()
    await dialog.getByRole('button', { name: 'Publish', exact: true }).click()
    await page.getByRole('button', { name: 'Select records', exact: true }).waitFor()
    const matching = await Product.query().where('categoryId', category.id)
    assert.isTrue(matching.every((row) => row.status === 'published'))
    const outside = await Product.findByOrFail('sku', 'MOBILE-12')
    assert.equal(outside.status, 'draft')
    assert.equal(await summary.textContent(), '')
  })

  test('users without bulk permission keep navigation and sorting without selection', async ({
    visit,
    browserContext,
    assert,
  }) => {
    await catalog()
    await browserContext.loginAs(await createUser('staff'))
    const page = await visit('/admin/resources/products')
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByLabel('Sort by', { exact: true }).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Select records', exact: true }).count(), 0)
    assert.isAbove(await page.locator('.azu-list-cards a').count(), 0)
  })
})
