import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Category from '#models/category'
import Product from '#models/product'
import { createUser, insertProducts } from '../functional/admin/helpers.ts'
import { axeViolations } from './axe.ts'

/**
 * "Select all N matching" (FR-17): from a full page selection to every
 * filtered row, the confirm dialog's chunking note, and the run.
 */
test.group('Bulk actions on all matching rows (FR-17)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('selects every matching row, warns about batches, and publishes them all', async ({
    visit,
    browserContext,
    assert,
  }) => {
    await browserContext.loginAs(await createUser('admin'))
    const kitchen = await Category.create({ name: 'Kitchen', slug: 'kitchen-bulk-all' })
    const garden = await Category.create({ name: 'Garden', slug: 'garden-bulk-all' })
    await insertProducts(kitchen, 520)
    await insertProducts(garden, 3)

    const page = await visit(`/admin/resources/products?category=${kitchen.id}&perPage=10`)
    const toolbar = page.getByRole('toolbar', { name: 'Bulk actions' })
    // A live region outside the bar, which comes and goes with the selection
    const summary = page.locator('[data-azu-selection-status]')
    // React Aria's checkbox input is visually hidden: press its label
    const selectPage = () =>
      page
        .locator('.azu-checkbox', { has: page.getByRole('checkbox', { name: 'Select All' }) })
        .click()

    await selectPage()
    await summary.filter({ hasText: '10 selected' }).waitFor()
    await toolbar.getByRole('button', { name: 'Select all 520 matching' }).click()
    await summary.filter({ hasText: 'All 520 matching selected' }).waitFor()

    // Clearing goes back to nothing selected; then select them all again
    await toolbar.getByRole('button', { name: 'Clear selection' }).click()
    await toolbar.getByRole('button', { name: 'Select all 520 matching' }).waitFor({
      state: 'detached',
    })
    assert.equal(await summary.textContent(), '')
    await selectPage()
    await toolbar.getByRole('button', { name: 'Select all 520 matching' }).click()

    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      assert.deepEqual(await axeViolations(page), [], `toolbar, ${colorScheme}`)
    }

    await toolbar.getByRole('button', { name: 'Actions', exact: true }).click()
    await page
      .getByRole('menu', { name: 'Actions' })
      .getByRole('menuitem', { name: 'Publish' })
      .click()
    const dialog = page.getByRole('alertdialog')
    await dialog.waitFor()
    assert.include(await dialog.textContent(), 'all 520 matching products')
    assert.include(await dialog.textContent(), 'It runs in batches of 500, each saved on its own.')
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      assert.deepEqual(await axeViolations(page), [], `dialog, ${colorScheme}`)
    }

    await dialog.getByRole('button', { name: 'Publish' }).click()
    await page.getByText('Publish: done for 520 products.').waitFor()
    // The list reloads and the selection clears
    await page.waitForFunction(
      () =>
        (globalThis as any).document.querySelector('[data-azu-selection-status]')?.textContent ===
        ''
    )

    const kitchenRows = await Product.query().where('categoryId', kitchen.id)
    assert.isTrue(kitchenRows.every((product) => product.status === 'published'))
    const gardenRows = await Product.query().where('categoryId', garden.id)
    assert.isTrue(gardenRows.every((product) => product.status === 'draft'))
  })
})
