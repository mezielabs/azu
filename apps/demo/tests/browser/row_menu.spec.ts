import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import Category from '#models/category'
import Coupon from '#models/coupon'
import Order from '#models/order'
import Product from '#models/product'
import { createUser } from '../functional/admin/helpers.ts'
import { axeViolations } from './axe.ts'

async function clayPot() {
  const category = await Category.create({ name: 'Kitchen', slug: 'kitchen-row-menu' })
  return Product.create({
    categoryId: category.id,
    name: 'Clay pot',
    sku: 'MENU-POT',
    price: '5.00',
    stock: 3,
    status: 'draft',
    isFeatured: false,
  })
}

const items = (page: any) => page.getByRole('menu').getByRole('menuitem').allInnerTexts()

/**
 * The row "⋯" menu: View and Edit when the server allows them for that
 * row, a separator, then the row actions, destructive last.
 */
test.group('Row menu', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('View, Edit, a separator, then the row actions with Delete last', async ({
    visit,
    browserContext,
    assert,
  }) => {
    await browserContext.loginAs(await createUser('admin'))
    const product = await clayPot()
    const page = await visit('/admin/resources/products')

    await page.getByRole('button', { name: 'Actions for Clay pot' }).click()
    assert.deepEqual(await items(page), ['View', 'Edit', 'Restock', 'Delete'])
    const menu = page.getByRole('menu')
    assert.equal(await menu.getByRole('separator').count(), 1)
    assert.equal(
      await menu.getByRole('menuitem', { name: 'Edit' }).getAttribute('href'),
      `/admin/resources/products/${product.id}/edit`
    )
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      assert.deepEqual(
        await axeViolations(page, { popoverOpen: true }),
        [],
        `row menu, ${colorScheme}`
      )
    }

    await menu.getByRole('menuitem', { name: 'View' }).click()
    await page.waitForURL(`**/admin/resources/products/${product.id}`)
  })

  test('a resource with no row actions still gets the menu: View only, without update', async ({
    visit,
    browserContext,
    assert,
  }) => {
    await browserContext.loginAs(await createUser('admin'))
    const customer = await createUser('customer')
    await Order.create({
      userId: customer.id,
      number: 'MENU-ORDER',
      status: 'paid',
      total: '10.00',
      placedAt: DateTime.now(),
    })
    const page = await visit('/admin/resources/orders')

    await page.getByRole('button', { name: 'Actions for MENU-ORDER' }).click()
    assert.deepEqual(await items(page), ['View'])
    assert.equal(await page.getByRole('menu').getByRole('separator').count(), 0)
  })

  test('forbidden: a user who may view but not update a row sees View only', async ({
    visit,
    browserContext,
    assert,
  }) => {
    await browserContext.loginAs(await createUser('staff'))
    await Coupon.create({
      code: 'STAFF10',
      kind: 'percent',
      amount: '10.00',
      currency: 'NGN',
      isActive: true,
      startsOn: DateTime.fromISO('2026-10-01'),
    })
    const page = await visit('/admin/resources/coupons')

    await page.getByRole('button', { name: 'Actions for STAFF10' }).click()
    assert.deepEqual(await items(page), ['View'])
  })

  test('on phone cards, the menu is a 44px button outside the card link', async ({
    visit,
    browserContext,
    assert,
  }) => {
    await browserContext.loginAs(await createUser('admin'))
    await clayPot()
    const page = await visit('/admin/resources/products')
    await page.setViewportSize({ width: 390, height: 844 })

    const button = page
      .locator('.azu-list-cards')
      .getByRole('button', { name: 'Actions for Clay pot' })
    await button.waitFor()
    const box = (await button.boundingBox())!
    assert.isAtLeast(Math.round(box.width), 44)
    assert.isAtLeast(Math.round(box.height), 44)
    assert.isFalse(await button.evaluate((element: any) => Boolean(element.closest('a'))))

    await button.click()
    assert.deepEqual(await items(page), ['View', 'Edit', 'Restock', 'Delete'])
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      assert.deepEqual(
        await axeViolations(page, { popoverOpen: true }),
        [],
        `card menu, ${colorScheme}`
      )
    }
  })
})
