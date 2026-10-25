import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import type { Page } from 'playwright'
import Category from '#models/category'
import Product from '#models/product'
import Tag from '#models/tag'
import { createUser, insertProducts } from '../functional/admin/helpers.ts'
import { axeViolations } from './axe.ts'

async function sizes(page: Page, selector: string) {
  return page.locator(selector).evaluateAll((elements: any[]) =>
    elements
      .map((element) => {
        const box = element.getBoundingClientRect()
        return {
          label: element.getAttribute('aria-label') || element.className,
          height: box.height,
          width: box.width,
        }
      })
      .filter((box) => box.height > 0 && box.width > 0)
  )
}

async function touchSized(page: Page, selector: string, width = 0) {
  const controls = await sizes(page, selector)
  return (
    controls.length > 0 &&
    controls.every((control) => control.height >= 44 && control.width >= width)
  )
}

test.group('Touch control sizing', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('forms, relations, dialogs and pagination have touch-sized controls', async ({
    browser,
    assert,
    cleanup,
  }) => {
    const admin = await createUser('admin')
    const category = await Category.create({ name: 'Kitchen', slug: 'touch-controls' })
    const tag = await Tag.create({ name: 'Clay', slug: 'touch-clay' })
    await insertProducts(category, 11, 'Clay pot')
    const product = await Product.firstOrFail()
    await product.related('tags').attach([tag.id])
    for (const width of [390, 1280]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        hasTouch: true,
        baseURL: `http://${process.env.HOST}:${process.env.PORT}`,
      })
      cleanup(() => context.close())
      await context.loginAs(admin)
      const page = await context.newPage()
      await page.goto(`/admin/resources/products/${product.id}/edit`)
      await page.locator('[data-azu-field="sku"] input').waitFor()
      await page.getByRole('button', { name: 'Remove Clay', exact: true }).waitFor()
      const controls = await sizes(
        page,
        '.azu-field .azu-input, .azu-radio, .azu-combobox-button, .azu-tag-remove, .azu-save-bar .azu-button'
      )
      assert.isAbove(controls.length, 8)
      assert.isTrue(
        controls.every((control) => control.height >= 44),
        JSON.stringify(controls)
      )
      assert.isTrue(await touchSized(page, '.azu-combobox-button, .azu-tag-remove', 44))
      await page.locator('[aria-label="Show Category options"]').click()
      await page.locator('.azu-popover [role="option"]').first().waitFor()
      assert.isTrue(await touchSized(page, '.azu-popover [role="option"]'))
      await page.keyboard.press('Escape')
      await page.goto('/admin/resources/products?perPage=10')
      await page.getByRole('button', { name: 'Next', exact: true }).waitFor()
      assert.isTrue(await touchSized(page, '.azu-page-button', 44))
      await page.getByRole('button', { name: 'Actions for Clay pot', exact: true }).first().click()
      await page.getByRole('menuitem', { name: 'Restock', exact: true }).waitFor()
      assert.isTrue(await touchSized(page, '.azu-popover [role="menuitem"]'))
      await page.getByRole('menuitem', { name: 'Restock', exact: true }).click()
      await page.getByRole('alertdialog').getByLabel('Quantity').waitFor()
      assert.isTrue(await touchSized(page, '.azu-dialog .azu-input, .azu-dialog .azu-button'))
      assert.deepEqual(await axeViolations(page), [])
    }
  })

  test('calendar and select controls stay usable on narrow phones', async ({
    visit,
    browserContext,
    assert,
  }) => {
    await browserContext.loginAs(await createUser('admin'))
    const page = await visit('/admin/resources/coupons/create')
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 900 })
      await page
        .locator('[data-azu-field="startsOn"]')
        .getByRole('button', { name: 'Open calendar' })
        .click()
      const calendar = page.getByRole('dialog', { name: 'Calendar', exact: true })
      await calendar.waitFor()
      assert.isTrue(await touchSized(page, '.azu-calendar-cell', width === 390 ? 44 : 38))
      const box = (await calendar.boundingBox())!
      assert.isAtLeast(box.x, 0)
      assert.isAtMost(box.x + box.width, width)
      await page.keyboard.press('Escape')
    }
    await page.locator('[data-azu-field="currency"]').getByRole('button').click()
    await page.getByRole('option').first().waitFor()
    assert.isTrue(await touchSized(page, '.azu-popover [role="option"]'))
  })
})
