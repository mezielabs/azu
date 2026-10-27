import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import Category from '#models/category'
import Order from '#models/order'
import Product from '#models/product'
import { createUser, withScreen } from '../functional/admin/helpers.ts'
import { defineScreen, metric } from '@mezielabs/azu'
import orderResource from '#admin/resources/order_resource'
import { accessAdmin } from '#abilities/main'
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

/**
 * Holds back the responses of widget props matching `key`, on URLs
 * matching `url`, until `release()`
 */
async function holdWidget(page: any, key: string | RegExp, url: RegExp) {
  let release!: () => void
  let captured!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const seen = new Promise<void>((resolve) => {
    captured = resolve
  })
  await page.route(
    (target: URL) => url.test(target.pathname + target.search),
    async (route: any) => {
      const partial = route.request().headers()['x-inertia-partial-data'] ?? ''
      const matches = typeof key === 'string' ? partial === key : key.test(partial)
      if (!matches) return route.continue()
      const response = await route.fetch()
      captured()
      await gate
      // The browser may have cancelled it meanwhile
      await route.fulfill({ response }).catch(() => {})
    }
  )
  return { release: () => release(), captured: seen }
}

/** The range button is pressed, and every widget's request has finished */
async function settled(page: any, label: string) {
  await page
    .getByRole('group', { name: 'Date range' })
    .locator('[aria-pressed="true"]', { hasText: label })
    .waitFor()
  await page.waitForLoadState('networkidle')
  await loaded(page)
}

/** Only the digits: "NGN 194,000.00" and "194000.00" both read 19400000 */
const digits = (text: string | null) => (text === null ? null : text.replace(/\D/g, ''))

/** Each value card's figure, by label, as digits */
async function figures(page: any) {
  const cards: [string, string | null][] = await page
    .locator('[data-azu-widget="value"]')
    .evaluateAll((items: any[]) =>
      items.map((card) => [
        card.querySelector('.azu-widget-label').textContent,
        card.querySelector('.azu-widget-figure')?.textContent ?? null,
      ])
    )
  return Object.fromEntries(cards.map(([label, figure]) => [label, digits(figure)]))
}

/** What the server says for the selected range, each value card's figure as digits */
async function serverFigures(page: any) {
  const values: Record<string, string | null> = await page.evaluate(async () => {
    const doc = (globalThis as any).document
    // Inertia 3 writes the first page in a JSON script tag
    const element = doc.querySelector('[data-page]')
    const first = JSON.parse(
      element.tagName === 'SCRIPT' ? element.textContent : element.dataset.page
    ) as { version?: string }
    const version = first.version ?? ''
    const current = (globalThis as any).location.href
    const headers = { 'X-Inertia': 'true', 'X-Inertia-Version': version }
    const pageResponse = await fetch(current, { headers })
    const { props } = (await pageResponse.json()) as { props: any }
    const result: Record<string, string | null> = {}
    for (const widget of props.widgets.filter((item: any) => item.kind === 'value')) {
      const partial = await fetch(current, {
        headers: {
          ...headers,
          'X-Inertia-Partial-Component': 'azu/screen',
          'X-Inertia-Partial-Data': widget.key,
        },
      })
      const body = (await partial.json()) as { props: Record<string, any> }
      const data = body.props[widget.key]
      result[widget.label] = data.status === 'ok' ? data.value : null
    }
    return result
  })
  return Object.fromEntries(Object.entries(values).map(([label, value]) => [label, digits(value)]))
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

  /**
   * C01: the figures always belong to the selected range. Each test holds
   * an old response back, changes the range, then lets it go: the cards
   * must end up with what the server says for the range that's selected.
   */
  for (const initialLoad of [false, true]) {
    test(`C01: an old ${initialLoad ? 'deferred load' : 'range reload'} cannot overwrite the selected range`, async ({
      visit,
      browserContext,
      assert,
      cleanup,
    }) => {
      await store()
      await browserContext.loginAs(await createUser('admin'))
      const page = await visit('/admin')
      await loaded(page)
      const held = await holdWidget(page, 'widget1', initialLoad ? /\/admin$/ : /range=7d/)
      cleanup(() => held.release())

      const switcher = page.getByRole('group', { name: 'Date range' })
      if (initialLoad) await page.goto('/admin')
      else await switcher.getByRole('button', { name: '7 days' }).click()
      await held.captured
      const selected = initialLoad ? '7 days' : '30 days'
      await switcher.getByRole('button', { name: selected }).click()
      await settled(page, selected)
      // The old response arrives last, and changes nothing
      held.release()
      await page.waitForTimeout(300)
      await settled(page, selected)
      assert.deepEqual(await figures(page), await serverFigures(page))
    })
  }

  test('C01: rapid repeated switches end on the last range, with its figures', async ({
    visit,
    browserContext,
    assert,
    cleanup,
  }) => {
    await store()
    await browserContext.loginAs(await createUser('admin'))
    const page = await visit('/admin')
    await loaded(page)
    // Every 7-day and 90-day widget response is slow
    const slow = await holdWidget(page, /^widget/, /range=(7d|90d)/)
    cleanup(() => slow.release())
    const switcher = page.getByRole('group', { name: 'Date range' })
    for (const label of ['7 days', '90 days', 'This month', '7 days', 'Today']) {
      await switcher.getByRole('button', { name: label }).click()
    }
    await settled(page, 'Today')
    slow.release()
    await page.waitForTimeout(300)
    await settled(page, 'Today')
    assert.match(page.url(), /range=today$/)
    assert.deepEqual(await figures(page), await serverFigures(page))
  })

  test('C01: switching away and straight back ends on the range clicked last', async ({
    visit,
    browserContext,
    assert,
    cleanup,
  }) => {
    await store()
    await browserContext.loginAs(await createUser('admin'))
    const page = await visit('/admin')
    await loaded(page)
    // The 7-day range visit is slow, so 30 days is clicked while it's in flight
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    cleanup(() => release())
    await page.route(
      (target: URL) => /range=7d/.test(target.search),
      async (route: any) => {
        if (route.request().headers()['x-inertia-partial-data'] !== 'range') return route.continue()
        await gate
        await route.continue().catch(() => {})
      }
    )
    const switcher = page.getByRole('group', { name: 'Date range' })
    await switcher.getByRole('button', { name: '7 days' }).click()
    await switcher.getByRole('button', { name: '30 days' }).click()
    release()
    await settled(page, '30 days')
    assert.match(page.url(), /\/admin$/)
    assert.deepEqual(await figures(page), await serverFigures(page))
  })

  test("C01: a retry still loading when the range changes doesn't corrupt the cards", async ({
    visit,
    browserContext,
    assert,
    cleanup,
  }) => {
    await store()
    // Average order fails its first load, so it offers Try again
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

    // The 30-day retry is held back while the range changes to 7 days
    const held = await holdWidget(page, 'widget2', /\/admin$/)
    cleanup(() => held.release())
    await card.getByRole('button', { name: /Try again/ }).click()
    await held.captured
    await page
      .getByRole('group', { name: 'Date range' })
      .getByRole('button', { name: '7 days' })
      .click()
    await settled(page, '7 days')
    held.release()
    await page.waitForTimeout(300)
    await settled(page, '7 days')
    assert.deepEqual(await figures(page), await serverFigures(page))
  })

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

  test('average partitions show values without misleading percentages', async ({
    visit,
    browserContext,
    assert,
    cleanup,
  }) => {
    await store()
    await withScreen(
      'average-partition',
      defineScreen({
        label: 'Average order by status',
        ability: accessAdmin,
        widgets: [
          metric.partition('Average order').avg(orderResource, 'total').groupBy('status').limit(1),
        ],
      }),
      cleanup
    )
    await browserContext.loginAs(await createUser('admin'))
    const page = await visit('/admin/screens/average-partition')
    await loaded(page)
    const partition = page.locator('.azu-partition')
    assert.notInclude(await partition.innerText(), '%')
    assert.equal(await partition.locator('li').count(), 2)
    assert.include(await partition.innerText(), 'Other')
    assert.deepEqual(await axeViolations(page), [])
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
