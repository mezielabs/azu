import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Category from '#models/category'
import { createUser, insertProducts } from '../functional/admin/helpers.ts'
import { axeViolations } from './axe.ts'

test.group('List column visibility', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('reveals columns, preserves choices through list updates, guards the last column and resets', async ({
    visit,
    browserContext,
    assert,
  }) => {
    await browserContext.loginAs(await createUser('admin'))
    const category = await Category.create({ name: 'Kitchen', slug: 'columns-desktop' })
    await insertProducts(category, 11, 'Clay pot')
    const page = await visit('/admin/resources/products?perPage=10')
    const trigger = page.getByRole('button', { name: 'Columns', exact: true })
    const dialog = page.getByRole('dialog', { name: 'Visible columns' })
    assert.equal(await page.getByRole('columnheader', { name: 'SKU', exact: true }).count(), 0)
    await trigger.click()
    const sku = dialog.getByRole('checkbox', { name: 'SKU', exact: true })
    await sku.check()
    await dialog.getByRole('checkbox', { name: 'Price', exact: true }).uncheck()
    await page.keyboard.press('Escape')
    assert.isTrue(await trigger.evaluate((e: any) => e === e.ownerDocument.activeElement))
    await page.getByRole('columnheader', { name: 'SKU', exact: true }).waitFor()
    assert.equal(await page.getByRole('columnheader', { name: 'Price', exact: true }).count(), 0)
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await page.waitForURL(/page=2/)
    await page.getByRole('columnheader', { name: 'SKU', exact: true }).waitFor()
    await trigger.click()
    const options = dialog.getByRole('checkbox')
    for (const option of await options.all()) {
      if (
        (await option.isChecked()) &&
        (await option.evaluate((e: any) => e.parentElement.textContent.trim())) !== 'SKU'
      )
        await option.uncheck()
    }
    assert.isTrue(await sku.isDisabled())
    await dialog.getByRole('button', { name: 'Reset to defaults' }).click()
    assert.isFalse(await sku.isChecked())
    await page.keyboard.press('Escape')
    await page.getByRole('columnheader', { name: 'Price', exact: true }).waitFor()
    await trigger.click()
    await sku.check()
    await page.keyboard.press('Escape')
    await page.reload()
    await page.getByRole('button', { name: 'Columns', exact: true }).waitFor()
    assert.equal(await page.getByRole('columnheader', { name: 'SKU', exact: true }).count(), 0)
    const search = page.getByRole('searchbox', { name: 'Search products' })
    await search.fill('No such product')
    await search.press('Enter')
    await page.waitForURL(/search=No/)
    await trigger.click()
    await sku.check()
    await page.keyboard.press('Escape')
    await page.getByRole('columnheader', { name: 'SKU', exact: true }).waitFor()
    assert.equal(await page.locator('.azu-table tbody .azu-row').count(), 0)
  })

  test('phone cards show chosen columns beyond the former two-detail limit', async ({
    visit,
    browserContext,
    assert,
  }) => {
    await browserContext.loginAs(await createUser('admin'))
    const category = await Category.create({ name: 'Kitchen', slug: 'columns-phone' })
    await insertProducts(category, 1, 'Clay pot')
    const page = await visit('/admin/resources/products')
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 })
      await page.getByRole('button', { name: 'Columns', exact: true }).click()
      const dialog = page.getByRole('dialog', { name: 'Visible columns' })
      await dialog.getByRole('checkbox', { name: 'SKU', exact: true }).check()
      assert.deepEqual(await axeViolations(page, { popoverOpen: true }), [])
      await page.keyboard.press('Escape')
      const details = page.locator('.azu-card-details')
      assert.include(await details.innerText(), 'SKU:')
      assert.equal(await details.locator(':scope > span').count(), 4)
      const detailBox = (await details.boundingBox())!
      const badgeBox = (await page.locator('.azu-card-badge').boundingBox())!
      assert.isAtLeast(badgeBox.y, detailBox.y + detailBox.height)
      const overflow = await page.evaluate(() => {
        const d = (globalThis as any).document.documentElement
        return d.scrollWidth > d.clientWidth
      })
      assert.isFalse(overflow)
      for (const colorScheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme })
        assert.deepEqual(await axeViolations(page), [])
      }
    }
  })
})
