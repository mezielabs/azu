import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import drive from '@adonisjs/drive/services/main'
import { DateTime } from 'luxon'
import Category from '#models/category'
import Order from '#models/order'
import Product from '#models/product'
import productResource from '#admin/resources/product_resource'
import { action } from '@mezielabs/azu'
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

    // Two row actions: both buttons, Delete last, then Edit, the primary
    assert.deepEqual(await page.locator('.azu-page-actions > *').allInnerTexts(), [
      'Restock',
      'Delete',
      'Edit',
    ])
    assert.equal(
      await page
        .getByRole('button', { name: 'Delete', exact: true })
        .getAttribute('data-azu-destructive'),
      'true'
    )
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      assert.deepEqual(await axeViolations(page), [], `detail, ${colorScheme}`)
    }
  })

  test('six row actions: the header keeps one line at 1440px and 900px, and a long title truncates', async ({
    visit,
    browserContext,
    assert,
    cleanup,
  }) => {
    await browserContext.loginAs(await createUser('admin'))
    const { record } = await product()
    record.name = `Lagos Noir: ${'twelve stories set between Yaba and the Island, '.repeat(3).trim()}`
    await record.save()
    const page = await visit(`/admin/resources/products/${record.id}`)

    // Where the panels start with the usual two row actions
    const panelsTop = async (width: number) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`/admin/resources/products/${record.id}`)
      await page.locator('.azu-detail-main').waitFor()
      return (await page.locator('.azu-detail-main').boundingBox())!.y
    }
    const before = { 1440: await panelsTop(1440), 900: await panelsTop(900) }

    // Restock, archive, export, duplicate, purge and Delete
    const declared = productResource.actions()
    const extra = [
      action.row('archive').handle(async () => {}),
      action.row('export').handle(async () => {}),
      action.row('duplicate').handle(async () => {}),
      action
        .row('purge')
        .destructive()
        .handle(async () => {}),
    ]
    // Before the built-in Deletes (row and bulk), so Delete is declared last
    const deletes = declared.filter((item) => item.name === 'delete')
    const others = declared.filter((item) => item.name !== 'delete')
    productResource.actions = () => [...others, ...extra, ...deletes] as never
    cleanup(() => {
      delete (productResource as { actions?: unknown }).actions
    })

    const header = page.locator('.azu-page-header')
    const actions = page.locator('.azu-page-actions')
    const oneLine = async (width: 1440 | 900) => {
      assert.equal(await panelsTop(width), before[width], `${width}px: the panels don't move`)
      const layout = await header.evaluate((element: any) => {
        const title = element.querySelector('.azu-page-title-text')
        const heading = element.querySelector('.azu-page-title')
        const bar = element.querySelector('.azu-page-actions')
        const middle = (child: any) => {
          const box = child.getBoundingClientRect()
          return Math.round(box.top + box.height / 2)
        }
        return {
          actionRows: new Set([...bar.children].map(middle)).size,
          // The title and the actions share the header's line
          sideBySide: bar.getBoundingClientRect().left >= heading.getBoundingClientRect().right,
          truncated: title.scrollWidth > title.clientWidth,
          tooltip: heading.getAttribute('title'),
          overflows: element.scrollWidth > element.clientWidth,
        }
      })
      assert.equal(layout.actionRows, 1, `${width}px`)
      assert.isTrue(layout.sideBySide, `${width}px`)
      assert.isTrue(layout.truncated, `${width}px`)
      assert.equal(layout.tooltip, record.name)
      assert.isFalse(layout.overflows, `${width}px`)
      assert.include(await page.title(), record.name)
    }
    const menuAxe = async (width: number) => {
      for (const colorScheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme })
        assert.deepEqual(
          await axeViolations(page, { popoverOpen: true }),
          [],
          `${width}px menu, ${colorScheme}`
        )
      }
    }

    // 1440px: two buttons, More with the rest (destructive last), then Edit
    await oneLine(1440)
    assert.deepEqual(await actions.locator(':scope > *').allInnerTexts(), [
      'Restock',
      'Archive',
      'More',
      'Edit',
    ])
    await actions.getByRole('button', { name: 'More' }).click()
    const more = page.getByRole('menu', { name: 'More' })
    assert.deepEqual(await more.getByRole('menuitem').allInnerTexts(), [
      'Export',
      'Duplicate',
      'Purge',
      'Delete',
    ])
    assert.deepEqual(await more.locator('.azu-is-destructive').allInnerTexts(), ['Purge', 'Delete'])
    await menuAxe(1440)
    await page.keyboard.press('Escape')
    await more.waitFor({ state: 'detached' })

    // 900px: every row action in one Actions menu; Edit stays a button
    await oneLine(900)
    assert.deepEqual(await actions.locator(':scope > *').allInnerTexts(), ['Actions', 'Edit'])
    await actions.getByRole('button', { name: 'Actions' }).click()
    assert.deepEqual(
      await page.getByRole('menu', { name: 'Actions' }).getByRole('menuitem').allInnerTexts(),
      ['Restock', 'Archive', 'Export', 'Duplicate', 'Purge', 'Delete']
    )
    await menuAxe(900)
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
