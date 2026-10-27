import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
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

/** Every widget's card, once its data is in (or it failed) */
async function loaded(page: any) {
  await page.waitForFunction(
    () => {
      const doc = (globalThis as any).document
      const cards = [...doc.querySelectorAll('.azu-widget')]
      return cards.length > 0 && cards.every((card: any) => card.dataset.azuState !== 'loading')
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
      'Revenue over time',
      'Cancelled orders',
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

  test('table widgets scroll inside their card rather than overflowing it', async ({
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
      const tables = await page.locator('[data-azu-widget="table"]').evaluateAll((cards: any[]) =>
        cards.map((card) => {
          const scroller = card.querySelector('.azu-table-container')
          const right = (element: any) => element.getBoundingClientRect().right
          return {
            label: card.querySelector('.azu-widget-label').textContent,
            // Nothing sticks out of the card, and the page doesn't scroll sideways
            overflows: card.scrollWidth > card.clientWidth || right(scroller) > right(card) + 0.5,
            scrolls: (globalThis as any).getComputedStyle(scroller).overflowX === 'auto',
            pageOverflows:
              (globalThis as any).document.documentElement.scrollWidth >
              (globalThis as any).innerWidth,
          }
        })
      )
      assert.lengthOf(tables, 2)
      for (const table of tables) {
        assert.isFalse(table.overflows, `${table.label} at ${width}px`)
        assert.isTrue(table.scrolls, `${table.label} at ${width}px`)
        assert.isFalse(table.pageOverflows, `the page at ${width}px`)
      }
    }
  })

  test('a widget that failed to load tries again on its own', async ({
    visit,
    browserContext,
    assert,
    cleanup,
  }) => {
    await store()
    // Average order fails its first load only
    const azu = await app.container.make('azu')
    const average = azu.screens.get('overview')!.widgets![2]
    const where = average.state.where!
    let calls = 0
    average.state.where = (query) => {
      calls++
      if (calls === 1) throw new Error('Test: the first load fails')
      return where(query)
    }
    cleanup(() => {
      average.state.where = where
    })

    await browserContext.loginAs(await createUser('admin'))
    const page = await visit('/admin')
    await loaded(page)
    const card = page.locator('[data-azu-widget="value"]').nth(2)
    await card.getByText("Couldn't load this").waitFor()
    assert.equal(await card.locator('.azu-widget-figure').count(), 0)

    const reloads: string[] = []
    page.on('request', (request: any) => {
      const key = request.headers()['x-inertia-partial-data']
      if (key) reloads.push(key)
    })
    await card.getByRole('button', { name: /Try again/ }).click()
    await card.locator('.azu-widget-figure').waitFor()
    assert.match(await card.locator('.azu-widget-figure').innerText(), /^NGN/)
    // Only that widget's prop was asked for again
    assert.deepEqual(reloads, ['widget2'])
  })

  test('with lowerIsBetter(), a decrease is styled and announced as better', async ({
    visit,
    browserContext,
    assert,
  }) => {
    const customer = await createUser('customer')
    const now = DateTime.now()
    // 1 cancelled in the last 30 days, 3 in the 30 days before
    for (const [index, days] of [1, 35, 40, 45].entries()) {
      await Order.create({
        userId: customer.id,
        number: `AZU-CXL-${index}`,
        status: 'cancelled',
        total: '100.00',
        placedAt: now.minus({ days }),
      })
    }
    await browserContext.loginAs(await createUser('admin'))
    const page = await visit('/admin')
    await loaded(page)
    const card = page.locator('.azu-widget', { hasText: 'Cancelled orders' })
    const delta = card.locator('.azu-widget-delta')
    assert.equal(await delta.getAttribute('data-azu-direction'), 'down')
    assert.equal(await delta.getAttribute('data-azu-outcome'), 'better')
    // The arrow shows the real direction; the words say it's better
    assert.equal(await delta.locator('[aria-hidden="true"]').innerText(), '▼')
    const words = await delta.innerText()
    assert.equal(words.replace(/\s+/g, ' ').trim(), '▼ Down 66.7% , better from 3')
    // Styled as better: the same colour as a rise in revenue
    const colour = await delta
      .locator('.azu-widget-change')
      .evaluate((element: any) => (globalThis as any).getComputedStyle(element).color)
    const green = await page.evaluate(() => {
      const probe = (globalThis as any).document.createElement('span')
      probe.style.color = 'var(--azu-badge-green-text)'
      ;(globalThis as any).document.body.append(probe)
      const value = (globalThis as any).getComputedStyle(probe).color
      probe.remove()
      return value
    })
    assert.equal(colour, green)
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
