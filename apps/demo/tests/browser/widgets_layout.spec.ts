import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import { defineScreen, metric } from '@mezielabs/azu'
import Order from '#models/order'
import orderResource from '#admin/resources/order_resource'
import { accessAdmin } from '#abilities/main'
import { createUser, withScreen } from '../functional/admin/helpers.ts'
import { axeViolations } from './axe.ts'

/** Intl writes a no-break space after a currency code */
const spaced = (text: string | null) => (text ?? '').replace(/\u00a0/g, ' ')

/**
 * A value from `using()`, and another one for the previous period, so
 * the comparison shows its previous value too
 */
function figure(current: number, previous = current) {
  return async (_ctx: unknown, range: { end: DateTime }) =>
    range.end < DateTime.now().minus({ days: 1 }) ? previous : current
}

test.group('Widget figure layout (U01)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('large figures are abbreviated, exact for screen readers and on hover, and fit their cards', async ({
    visit,
    browserContext,
    assert,
    cleanup,
  }) => {
    const customer = await createUser('customer')
    await Order.create({
      userId: customer.id,
      number: 'AZU-U01',
      status: 'paid',
      total: '4281750.50',
      placedAt: DateTime.now().minus({ minutes: 1 }),
    })
    await withScreen(
      'zz-currency-layout',
      defineScreen({
        label: 'Currency layout',
        ability: accessAdmin,
        widgets: [
          metric
            .value('Below')
            .using(figure(999_999.99))
            .ability(accessAdmin)
            .format('currency', 'NGN'),
          metric
            .value('At')
            .using(figure(1_000_000))
            .ability(accessAdmin)
            .format('currency', 'NGN'),
          metric
            .value('Negative')
            .using(figure(-1_050_000_000, -2_000_000))
            .ability(accessAdmin)
            .format('currency', 'NGN'),
          metric
            .value('Forced')
            .using(figure(194_000))
            .ability(accessAdmin)
            .format('currency', 'NGN')
            .compact(),
          metric
            .value('Full')
            .using(figure(1_234_567_890_123.45))
            .ability(accessAdmin)
            .format('currency', 'NGN')
            .compact(false),
          metric
            .value('Full negative')
            .using(figure(-1_234_567_890_123.45))
            .ability(accessAdmin)
            .format('currency', 'NGN')
            .compact(false),
          metric
            .progress('Goal')
            .sum(orderResource, 'total')
            .date('placedAt')
            .goal(6_000_000)
            .format('currency', 'NGN'),
          metric
            .partition('By status')
            .sum(orderResource, 'total')
            .groupBy('status')
            .format('currency', 'NGN'),
        ],
      }),
      cleanup
    )
    await browserContext.loginAs(await createUser('admin'))
    const page = await visit('/admin/screens/zz-currency-layout')
    const card = (label: string) => page.getByRole('region', { name: label, exact: true })
    await page.locator('.azu-widget[data-azu-state="ready"]').nth(7).waitFor()

    // What's shown, and what's in the tooltip
    const shown = async (label: string, selector = '.azu-widget-figure') => {
      const element = card(label).locator(selector).first()
      const short = element.locator('[aria-hidden="true"]')
      return {
        text: spaced(
          (await short.count()) ? await short.textContent() : await element.textContent()
        ),
        title: spaced(await element.getAttribute('title')),
      }
    }
    // The threshold on both sides
    assert.deepEqual(await shown('Below'), { text: 'NGN 999,999.99', title: '' })
    assert.deepEqual(await shown('At'), { text: 'NGN 1M', title: 'NGN 1,000,000.00' })
    // A negative figure, and its comparison's previous value
    assert.deepEqual(await shown('Negative'), {
      text: '-NGN 1.05B',
      title: '-NGN 1,050,000,000.00',
    })
    assert.deepEqual(await shown('Negative', '.azu-widget-delta [title]'), {
      text: '-NGN 2M',
      title: '-NGN 2,000,000.00',
    })
    // compact() and compact(false)
    assert.deepEqual(await shown('Forced'), { text: 'NGN 194K', title: 'NGN 194,000.00' })
    assert.deepEqual(await shown('Full'), { text: 'NGN 1,234,567,890,123.45', title: '' })
    assert.deepEqual(await shown('Full negative'), {
      text: '-NGN 1,234,567,890,123.45',
      title: '',
    })
    // Progress and partition figures
    assert.deepEqual(await shown('Goal', '.azu-widget-progress-value'), {
      text: 'NGN 4.28M',
      title: 'NGN 4,281,750.50',
    })
    assert.deepEqual(
      await shown(
        'Goal',
        '.azu-widget-progress-figures span[title]:not(.azu-widget-progress-value)'
      ),
      {
        text: 'NGN 6M',
        title: 'NGN 6,000,000.00',
      }
    )
    assert.deepEqual(await shown('By status', '.azu-partition-value strong'), {
      text: 'NGN 4.28M',
      title: 'NGN 4,281,750.50',
    })

    // Screen readers get the exact figure, never the short one
    const read = async (label: string) => spaced(await card(label).ariaSnapshot())
    assert.include(await read('At'), 'NGN 1,000,000.00')
    assert.notInclude(await read('At'), 'NGN 1M')
    assert.include(await read('Negative'), '-NGN 1,050,000,000.00')
    assert.include(await read('Negative'), '-NGN 2,000,000.00')
    assert.notInclude(await read('Negative'), '1.05B')
    assert.include(await read('Goal'), 'NGN 4,281,750.50')
    assert.include(await read('Goal'), 'NGN 6,000,000.00')
    assert.notInclude(await read('Goal'), '4.28M')
    assert.include(await read('By status'), 'NGN 4,281,750.50')
    assert.notInclude(await read('By status'), '4.28M')
    assert.include(await read('Below'), 'NGN 999,999.99')
    const valueText = await card('Goal').getByRole('progressbar').getAttribute('aria-valuetext')
    assert.match(spaced(valueText), /^71% of NGN 6,000,000\.00, /)

    const original = await page.locator('.azu-widget').allTextContents()
    for (const width of [1280, 1024, 390, 320]) {
      await page.setViewportSize({ width, height: 900 })
      for (const colorScheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme })
        for (const fontSize of ['100%', '200%']) {
          await page.evaluate((size) => {
            ;(globalThis as any).document.documentElement.style.fontSize = size
          }, fontSize)
          const measurements = await page.locator('.azu-widget').evaluateAll((cards: any[]) =>
            cards.map((element) => {
              const figures = [
                ...element.querySelectorAll(
                  '.azu-widget-figure, .azu-widget-delta, .azu-widget-progress-figures, .azu-partition-value'
                ),
              ]
              return {
                label: element.querySelector('.azu-widget-label')?.textContent,
                overflows:
                  element.scrollWidth > element.clientWidth ||
                  figures.some((item: any) => item.scrollWidth > item.clientWidth),
                clipped: figures.some((item: any) => {
                  const style = (globalThis as any).getComputedStyle(item)
                  return (
                    ['hidden', 'clip'].includes(style.overflow) || style.textOverflow === 'ellipsis'
                  )
                }),
              }
            })
          )
          assert.isTrue(
            measurements.every((item) => !item.overflows && !item.clipped),
            `${width}px ${colorScheme} ${fontSize}: ${JSON.stringify(measurements)}`
          )
          // Nothing is cut or rewritten at any size
          assert.deepEqual(await page.locator('.azu-widget').allTextContents(), original)
        }
      }
    }
    // A full figure wraps at its space before it splits digits
    await page.setViewportSize({ width: 320, height: 900 })
    await page.evaluate(() => {
      ;(globalThis as any).document.documentElement.style.fontSize = ''
    })
    const breaks = await card('Full negative')
      .locator('.azu-widget-figure')
      .evaluate((element: any) => {
        const document = (globalThis as any).document
        // "-NGN", its no-break space, a <wbr>, then the digits
        const texts = [...element.childNodes].filter((node: any) => node.nodeType === 3)
        const [code, digits] = [texts[0], texts.at(-1)]
        const tops = (node: any, to: number) => {
          const range = document.createRange()
          range.setStart(node, 0)
          range.setEnd(node, to)
          return [...range.getClientRects()].map((rect: any) => Math.round(rect.top))
        }
        return {
          code: code.data,
          lines: new Set(tops(code, code.data.length)).size,
          after: tops(digits, 1)[0] - tops(code, 1)[0],
        }
      })
    // "-NGN" stays whole, and the digits start on the next line
    assert.deepInclude(breaks, { code: '-NGN', lines: 1 })
    assert.isAbove(breaks.after, 0)
    assert.deepEqual(await axeViolations(page), [])
  })
})
