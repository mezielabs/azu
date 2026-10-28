import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import drive from '@adonisjs/drive/services/main'
import Category from '#models/category'
import Product from '#models/product'
import productResource from '#admin/resources/product_resource'
import { createUser } from '../functional/admin/helpers.ts'
import { axeViolations } from './axe.ts'

test.group('Mobile record readability', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('long identities, details and badges fit with or without images', async ({
    visit,
    browserContext,
    assert,
    cleanup,
  }) => {
    const name =
      'Ceramic serving bowl with a hand-painted coastal pattern and matching lid for large family gatherings'
    const categoryName = 'Kitchenware and handmade tableware collections'
    const statusLabel = 'Awaiting warehouse publication review'
    const status = productResource.options.fields!.find((item) => item.name === 'status')!
    const original = status.toJSON
    status.toJSON = () => ({
      ...original.call(status),
      options: { draft: statusLabel, published: 'Published' },
    })
    cleanup(() => {
      status.toJSON = original
    })
    const category = await Category.create({ name: categoryName, slug: 'mobile-readability' })
    const thumbnail = 'review-readability/bowl.svg'
    await drive
      .use()
      .put(
        thumbnail,
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="28" fill="#15803d"/></svg>'
      )
    cleanup(() => drive.use().delete(thumbnail))
    for (let index = 0; index < 2; index++) {
      await Product.create({
        categoryId: category.id,
        name: `${name} ${index + 1}`,
        sku: `READABLE-${index}`,
        price: '123456789.50',
        stock: 2,
        status: 'draft',
        isFeatured: false,
        thumbnail: index === 0 ? thumbnail : null,
      })
    }
    await browserContext.loginAs(await createUser('admin'))
    const page = await visit('/admin/resources/products')
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 })
      await page.locator('.azu-list-cards').waitFor()
      const titles = await page.locator('.azu-card-title').allTextContents()
      assert.sameMembers(titles, [`${name} 1`, `${name} 2`])
      assert.equal(await page.locator('.azu-card-picture img').count(), 1)
      assert.equal(await page.locator('.azu-card-picture .azu-thumbnail-empty').count(), 1)
      const measurements = await page.locator('.azu-card').evaluateAll((cards: any[]) =>
        cards.map((card) => {
          const title = card.querySelector('.azu-card-title')
          const details = card.querySelector('.azu-card-details')
          const badge = card.querySelector('.azu-card-badge')
          const style = (globalThis as any).getComputedStyle(title)
          return {
            overflows: [card, title, details, badge].some(
              (element) => element.scrollWidth > element.clientWidth
            ),
            titleLines: title.clientHeight / Number.parseFloat(style.lineHeight),
            badgeBelow: badge.getBoundingClientRect().top >= details.getBoundingClientRect().bottom,
          }
        })
      )
      assert.isTrue(
        measurements.every((item) => !item.overflows && item.titleLines <= 2.1 && item.badgeBelow),
        JSON.stringify(measurements)
      )
      for (const colorScheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme })
        assert.deepEqual(await axeViolations(page), [])
      }
    }
    await page.getByRole('button', { name: `Actions for ${name} 2`, exact: true }).click()
    await page.getByRole('menuitem', { name: 'View', exact: true }).click()
    await page.waitForURL(/\/admin\/resources\/products\/\d+$/)
  })
})
