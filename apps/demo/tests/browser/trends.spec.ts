import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import Order from '#models/order'
import { createUser } from '../functional/admin/helpers.ts'
import { axeViolations } from './axe.ts'

/** Paid orders on most of the last 40 days */
async function orders() {
  const customer = await createUser('customer')
  const midnight = DateTime.now().startOf('day')
  await Order.createMany(
    Array.from({ length: 40 }, (_, index) => ({
      userId: customer.id,
      number: `AZU-T-${index}`,
      status: index % 5 === 4 ? ('cancelled' as const) : ('paid' as const),
      total: `${1000 + index * 125}.50`,
      placedAt: midnight.minus({ days: index }).plus({ hours: 9 }),
    }))
  )
}

async function chart(page: any) {
  const plot = page.getByRole('group', { name: /^Revenue over time\. Arrow keys/ })
  await plot.waitFor()
  return plot
}

/**
 * Trend widgets in the browser (FR-25): the Overview's revenue trend
 */
test.group('Trends', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('hovering shows the tooltip; arrow keys, Home and End move it', async ({
    visit,
    browserContext,
    assert,
  }) => {
    await orders()
    await browserContext.loginAs(await createUser('admin'))
    const page = await visit('/admin')
    const plot = await chart(page)
    const tooltip = plot.locator('.azu-trend-tooltip')

    const box = await plot.boundingBox()
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2)
    await tooltip.waitFor()
    // The previous line names its own bucket: the same day 30 days before
    assert.match(
      await tooltip.innerText(),
      /^\w{3} \d{1,2} \w{3}\nNGN[\s\S]+\nPrevious \(\w{3} \d{1,2} \w{3}\): NGN/
    )
    // The y axis writes the currency as the cards and the tooltip do
    const axis: string[] = await plot
      .locator('svg text.azu-trend-axis:not(.azu-trend-x)')
      .evaluateAll((texts: any[]) => texts.map((text) => text.textContent))
    assert.isTrue(
      axis.every((text: string) => /^NGN\s[\d.]+K?$/.test(text)),
      axis.join(', ')
    )
    await page.mouse.move(0, 0)
    await tooltip.waitFor({ state: 'detached' })

    // One tab stop; it starts on the latest bucket
    await plot.focus()
    const today = DateTime.now().toFormat('ccc d LLL')
    assert.match(await tooltip.innerText(), new RegExp(`^${today}`))
    await page.keyboard.press('ArrowLeft')
    const yesterday = DateTime.now().minus({ days: 1 }).toFormat('ccc d LLL')
    assert.match(await tooltip.innerText(), new RegExp(`^${yesterday}`))
    await page.keyboard.press('Home')
    const first = DateTime.now().minus({ days: 29 }).toFormat('ccc d LLL')
    assert.match(await tooltip.innerText(), new RegExp(`^${first}`))
    await page.keyboard.press('End')
    assert.match(await tooltip.innerText(), new RegExp(`^${today}`))
    // Said to screen readers too
    const monthAgo = DateTime.now().minus({ days: 30 }).toFormat('ccc d LLL')
    assert.match(
      await plot.locator('[aria-live="polite"]').innerText(),
      new RegExp(`^${today}: NGN[\\s\\d,.]+\\. Previous \\(${monthAgo}\\): NGN`)
    )
    // ...and so does the tooltip
    assert.match(await tooltip.innerText(), new RegExp(`\\nPrevious \\(${monthAgo}\\): NGN`))
    // The image's label sums it up
    assert.match(
      (await plot.locator('svg').getAttribute('aria-label'))!,
      /^Revenue over time: NGN[\d,.\s]+ in total over 30 days; highest \w{3} \d{1,2} \w{3}, NGN/
    )
  })

  test('the table view shows the same buckets and values as the chart', async ({
    visit,
    browserContext,
    assert,
  }) => {
    await orders()
    await browserContext.loginAs(await createUser('admin'))
    const page = await visit('/admin?range=7d')
    const plot = await chart(page)
    // Every bucket's tooltip, from the keyboard
    await plot.focus()
    await page.keyboard.press('Home')
    const fromChart: string[] = []
    for (let index = 0; index < 7; index++) {
      const text = await plot.locator('.azu-trend-tooltip').innerText()
      const lines = text.split('\n')
      fromChart.push(`${lines[0]} ${lines[1]} ${lines[2].replace(/^Previous \([^)]*\): /, '')}`)
      await page.keyboard.press('ArrowRight')
    }

    const card = page.locator('[data-azu-widget="trend"]')
    await card.getByRole('button', { name: 'View as table' }).click()
    assert.equal(
      await card.getByRole('button', { name: 'View as table' }).getAttribute('aria-pressed'),
      'true'
    )
    const rows = await card
      .locator('.azu-trend-table tbody tr')
      .evaluateAll((items: any[]) =>
        items.map((row) => [...row.children].map((cell: any) => cell.textContent.trim()).join(' '))
      )
    assert.deepEqual(rows, fromChart)
    assert.deepEqual(await card.locator('.azu-trend-table thead th').allInnerTexts(), [
      'Day',
      'This period',
      'Previous period',
    ])
  })

  test('a day opens the list filtered to it, by click or Enter', async ({
    visit,
    browserContext,
  }) => {
    await orders()
    await browserContext.loginAs(await createUser('admin'))
    const page = await visit('/admin')
    const plot = await chart(page)
    await plot.focus()
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('Enter')
    const yesterday = DateTime.now().minus({ days: 1 }).toISODate()
    await page.waitForURL(`**/admin/resources/orders?placedAt=${yesterday}..${yesterday}`)

    await page.goBack()
    const again = await chart(page)
    const box = await again.boundingBox()
    // The last bucket, at the right edge of the plot
    await page.mouse.click(box.x + box.width - 12, box.y + box.height / 2)
    const today = DateTime.now().toISODate()
    await page.waitForURL(`**/admin/resources/orders?placedAt=${today}..${today}`)
  })

  test("x-axis labels don't overlap, desktop or phone, and axe passes in both themes", async ({
    visit,
    browserContext,
    assert,
  }) => {
    await orders()
    await browserContext.loginAs(await createUser('admin'))
    const page = await visit('/admin')
    for (const [width, height] of [
      [1440, 900],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height })
      for (const range of ['30d', 'today', '90d', 'year']) {
        await page.goto(`/admin?range=${range}`)
        const plot = await chart(page)
        const boxes = await plot.locator('.azu-trend-x').evaluateAll((labels: any[]) =>
          labels.map((label) => {
            const rect = label.getBoundingClientRect()
            return { left: rect.left, right: rect.right }
          })
        )
        const svg = (await plot.locator('svg').boundingBox())!
        assert.isAtLeast(boxes.length, 1, `${range} at ${width}px`)
        assert.isAtMost(boxes.length, 7, `${range} at ${width}px`)
        for (const [index, box] of boxes.entries()) {
          assert.isAtLeast(box.left, svg.x - 0.5, `${range} at ${width}px: inside the chart`)
          assert.isAtMost(box.right, svg.x + svg.width + 0.5, `${range} at ${width}px: inside`)
          if (index > 0) {
            assert.isBelow(boxes[index - 1].right, box.left, `${range} at ${width}px: no overlap`)
          }
        }
      }
      await page.goto('/admin')
      await chart(page)
      for (const colorScheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme })
        assert.deepEqual(await axeViolations(page), [], `Overview at ${width}px, ${colorScheme}`)
      }
    }
  })

  test('no sales in the range: a flat line, and says so', async ({
    visit,
    browserContext,
    assert,
  }) => {
    await browserContext.loginAs(await createUser('admin'))
    const page = await visit('/admin')
    const card = page.locator('[data-azu-widget="trend"]')
    await card.getByText('No orders in this range').waitFor()
    assert.match((await card.locator('svg').getAttribute('aria-label'))!, /no orders in this range/)
  })
})
