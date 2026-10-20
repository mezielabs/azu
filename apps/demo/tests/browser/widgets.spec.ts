import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import Category from '#models/category'
import Order from '#models/order'
import Product from '#models/product'
import { createUser } from '../functional/admin/helpers.ts'
import { axeViolations } from './axe.ts'

/** Orders over the last two months, and two products low on stock */
async function store() {
  const customer = await createUser('customer')
  const statuses = ['pending', 'paid', 'shipped', 'cancelled'] as const
  await Order.createMany(
    Array.from({ length: 24 }, (_, index) => ({
      userId: customer.id,
      number: `AZU-W-${index}`,
      status: statuses[index % statuses.length],
      total: `${1000 + index * 250}.50`,
      placedAt: DateTime.now().minus({ hours: 2 + index * 55 }),
    }))
  )
  const category = await Category.create({ name: 'Kitchen', slug: 'kitchen-widgets' })
  for (const [name, stock] of [
    ['Clay pot', 3],
    ['Spice rack', 8],
  ] as const) {
    await Product.create({
      categoryId: category.id,
      name,
      sku: `W-${name}`,
      price: '1500.00',
      stock,
      status: 'published',
      isFeatured: false,
    })
  }
}

/** Every widget's card, once its data is in */
async function loaded(page: any) {
  await page.waitForFunction(
    () => {
      const doc = (globalThis as any).document
      const cards = [...doc.querySelectorAll('.azu-widget')]
      return cards.length > 0 && cards.every((card: any) => card.dataset.azuState === 'ready')
    },
    undefined,
    { timeout: 15_000 }
  )
}

/**
 * Widgets on screens in the browser (FR-24): the demo's Overview.
 */
test.group('Widgets', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('the Overview renders its widgets and switches range', async ({
    visit,
    browserContext,
    assert,
  }) => {
    await store()
    await browserContext.loginAs(await createUser('admin'))
    const page = await visit('/admin')
    await loaded(page)

    const labels = await page.locator('.azu-widget-label').allInnerTexts()
    assert.deepEqual(labels, [
      'Revenue',
      'Orders',
      'Average order',
      'New customers',
      'Monthly revenue goal',
      'Orders by status',
      'Recent orders',
      'Low stock',
    ])
    await page.getByText(/compared with the 30 days before/).waitFor()
    const range = page.getByRole('group', { name: 'Date range' })
    assert.equal(
      await range.getByRole('button', { name: '30 days' }).getAttribute('aria-pressed'),
      'true'
    )
    const orders = page.locator('[data-azu-widget="value"]').nth(1)
    const before = await orders.locator('.azu-widget-figure').innerText()
    // The delta says its direction in words as well as the arrow
    assert.match(await orders.locator('.azu-widget-delta').innerText(), /(Up|Down|New|No change)/)

    await range.getByRole('button', { name: '7 days' }).click()
    await page.waitForURL('**/admin?range=7d')
    await page.getByText(/compared with the 7 days before/).waitFor()
    await loaded(page)
    assert.equal(
      await range.getByRole('button', { name: '7 days' }).getAttribute('aria-pressed'),
      'true'
    )
    assert.notEqual(await orders.locator('.azu-widget-figure').innerText(), before)

    // The goal has its own period, and says how far through it is
    const goal = page.getByRole('progressbar', { name: 'Monthly revenue goal' })
    assert.match((await goal.getAttribute('aria-valuetext'))!, /% of NGN\s750,000\.00/)
  })

  test('a partition row opens the list filtered by its value and the range', async ({
    visit,
    browserContext,
  }) => {
    await store()
    await browserContext.loginAs(await createUser('admin'))
    const page = await visit('/admin')
    await loaded(page)
    // "Paid: 3 orders, 23%. Show them" (Chrome spaces out the hidden words)
    await page.getByRole('link', { name: /^Paid ?: \d+ orders?, \d+% ?\. Show them$/ }).click()
    await page.waitForURL(
      /\/admin\/resources\/orders\?placedAt=\d{4}-\d\d-\d\d\.\.\d{4}-\d\d-\d\d&status=paid/
    )
    await page.getByRole('heading', { level: 1, name: 'Orders' }).waitFor()
  })

  test('staff see only the widgets they may', async ({ visit, browserContext, assert }) => {
    await store()
    await browserContext.loginAs(await createUser('staff'))
    const page = await visit('/admin')
    await loaded(page)
    assert.deepEqual(await page.locator('.azu-widget-label').allInnerTexts(), ['Low stock'])
    // Rows link to products staff may view
    await page
      .locator('[data-azu-widget="table"]')
      .getByRole('link', { name: 'Clay pot' })
      .waitFor()
  })

  test('the Overview passes axe in both themes, desktop and phone', async ({
    visit,
    browserContext,
    assert,
  }) => {
    await store()
    await browserContext.loginAs(await createUser('admin'))
    const page = await visit('/admin')
    for (const [width, height] of [
      [1440, 900],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height })
      await page.goto('/admin')
      await loaded(page)
      for (const colorScheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme })
        assert.deepEqual(await axeViolations(page), [], `Overview at ${width}px, ${colorScheme}`)
      }
      // One column on phones
      if (width === 390) {
        const columns = await page
          .locator('.azu-widgets')
          .evaluate(
            (grid: any) =>
              (globalThis as any).getComputedStyle(grid).gridTemplateColumns.split(' ').length
          )
        assert.equal(columns, 1)
      }
    }
  })
})
