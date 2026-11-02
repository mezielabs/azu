import { test } from '@japa/runner'
import type { Page } from 'playwright'
import testUtils from '@adonisjs/core/services/test_utils'
import Category from '#models/category'
import Product from '#models/product'
import { createUser } from '../functional/admin/helpers.ts'

async function clayPot() {
  const category = await Category.create({ name: 'Kitchen', slug: 'smoke-kitchen' })
  return Product.create({
    categoryId: category.id,
    name: 'Clay pot',
    sku: 'SMOKE-POT',
    price: '12.50',
    stock: 3,
    status: 'draft',
    isFeatured: false,
  })
}

/**
 * Signs in on the app's login page and comes back to `path` (U02).
 * Through the form, not `browserContext.loginAs()`: its session cookie
 * works in Chromium but not in Firefox or WebKit
 */
async function signIn(visit: (path: string) => Promise<Page>, path: string) {
  const admin = await createUser('admin')
  const page = await visit(path)
  await page.waitForURL('**/login')
  await page.getByLabel('Email', { exact: true }).fill(admin.email)
  await page.getByLabel('Password', { exact: true }).fill('secret-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.waitForURL(`**${path}`)
  return page
}

/**
 * The release smoke subset (R02): one journey per main surface, small
 * enough to run in Firefox and WebKit on every release, besides the full
 * Chromium suite. `node ace test browser --files tests/browser/smoke.spec.ts --browser=firefox`.
 */
test.group('Smoke (R02)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test("login: signing in on the app's page opens the panel", async ({ visit }) => {
    const admin = await createUser('admin')
    const page = await visit('/admin')
    await page.waitForURL('**/login')
    await page.getByLabel('Email', { exact: true }).fill(admin.email)
    await page.getByLabel('Password', { exact: true }).fill('secret-password')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await page.waitForURL('**/admin')
    await page.getByRole('heading', { level: 1, name: 'Overview' }).waitFor()
  })

  test('list: rows, search and sort', async ({ visit, assert }) => {
    const pot = await clayPot()
    await Product.create({
      categoryId: pot.categoryId,
      name: 'Brass cuff',
      sku: 'SMOKE-CUFF',
      price: '40.00',
      stock: 9,
      status: 'published',
      isFeatured: false,
    })
    const page = await signIn(visit, '/admin/resources/products')
    const grid = page.getByRole('grid', { name: 'Products' })
    await grid.getByRole('row', { name: /Clay pot/ }).waitFor()
    await grid.getByRole('row', { name: /Brass cuff/ }).waitFor()

    const search = page.getByRole('searchbox', { name: 'Search products' })
    await search.fill('Clay')
    await search.press('Enter')
    await page.waitForURL(/search=Clay/)
    await page.waitForFunction(
      () => (globalThis as any).document.querySelectorAll('.azu-table tbody .azu-row').length === 1
    )
    assert.include(await grid.innerText(), 'Clay pot')
    assert.notInclude(await grid.innerText(), 'Brass cuff')

    await page.getByRole('columnheader', { name: 'Name', exact: true }).click()
    await page.waitForURL(/sort=name/)
    assert.include(page.url(), 'search=Clay')
  })

  test('form: an edit saves and shows the record', async ({ visit, assert }) => {
    const pot = await clayPot()
    const page = await signIn(visit, `/admin/resources/products/${pot.id}/edit`)
    const name = page.locator('[data-azu-field="name"] input')
    await name.fill('Clay pot, large')
    await page.locator('[data-azu-field="price"] input').fill('15.00')
    await page.getByRole('button', { name: 'Save changes', exact: true }).click()
    await page.waitForURL(`**/admin/resources/products/${pot.id}`)
    await page.getByRole('heading', { level: 1, name: /Clay pot, large/ }).waitFor()
    await pot.refresh()
    assert.equal(pot.name, 'Clay pot, large')
    assert.equal(Number(pot.price), 15)
  })

  test('action: a row action with a dialog field runs on the server', async ({ visit, assert }) => {
    const pot = await clayPot()
    const page = await signIn(visit, '/admin/resources/products')
    await page.getByRole('button', { name: 'Actions for Clay pot' }).click()
    await page.getByRole('menuitem', { name: 'Restock' }).click()
    const dialog = page.getByRole('alertdialog')
    await dialog.getByLabel('Quantity').fill('5')
    await dialog.getByRole('button', { name: 'Restock', exact: true }).click()
    await page.getByText('Clay pot now has 8 in stock').waitFor()
    await dialog.waitFor({ state: 'detached' })
    await pot.refresh()
    assert.equal(pot.stock, 8)
  })

  test('Overview: every widget loads, and a range switch reloads them', async ({
    visit,
    assert,
  }) => {
    await clayPot()
    const page = await signIn(visit, '/admin')
    await page.getByRole('heading', { level: 1, name: 'Overview' }).waitFor()
    const settled = () =>
      page.waitForFunction(() => {
        const cards = [...(globalThis as any).document.querySelectorAll('.azu-widget')]
        return cards.length > 0 && cards.every((card: any) => card.dataset.azuState === 'ready')
      })
    await settled()
    assert.equal(await page.locator('.azu-widget[data-azu-state="error"]').count(), 0)

    const ranges = page.getByRole('group', { name: 'Date range' })
    await ranges.getByRole('button', { name: '7 days' }).click()
    await page.waitForURL(/range=7d/)
    await ranges.locator('[aria-pressed="true"]', { hasText: '7 days' }).waitFor()
    await settled()
    assert.equal(await page.locator('.azu-widget[data-azu-state="error"]').count(), 0)
  })
})
