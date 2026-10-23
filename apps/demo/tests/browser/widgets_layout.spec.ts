import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { defineScreen, metric } from '@mezielabs/azu'
import { accessAdmin } from '#abilities/main'
import { createUser, withScreen } from '../functional/admin/helpers.ts'
import { axeViolations } from './axe.ts'

test.group('Widget figure layout', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('full currency amounts fit narrow cards and enlarged text in both themes', async ({
    visit,
    browserContext,
    assert,
    cleanup,
  }) => {
    const amounts = [194000, -194000, 1234567890123.45, -1234567890123.45]
    await withScreen(
      'zz-currency-layout',
      defineScreen({
        label: 'Currency layout',
        ability: accessAdmin,
        widgets: amounts.map((value, index) =>
          metric
            .value(`Revenue ${index + 1}`)
            .using(async () => value)
            .ability(accessAdmin)
            .format('currency', 'NGN')
        ),
      }),
      cleanup
    )
    await browserContext.loginAs(await createUser('admin'))
    const page = await visit('/admin/screens/zz-currency-layout')
    await page.locator('.azu-widget-figure').nth(3).waitFor()
    const original = await page.locator('.azu-widget-figure').allTextContents()
    assert.lengthOf(original, 4)
    assert.match(original[0], /NGN\s194,000\.00/)
    assert.match(original[3], /-NGN\s1,234,567,890,123\.45/)
    for (const width of [1280, 1024, 390, 320]) {
      await page.setViewportSize({ width, height: 900 })
      for (const colorScheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme })
        for (const fontSize of ['100%', '200%']) {
          await page.evaluate((size) => {
            ;(globalThis as any).document.documentElement.style.fontSize = size
          }, fontSize)
          const measurements = await page.locator('.azu-widget').evaluateAll((cards: any[]) =>
            cards.map((card) => {
              const figure = card.querySelector('.azu-widget-figure')
              const style = (globalThis as any).getComputedStyle(figure)
              return {
                overflows:
                  card.scrollWidth > card.clientWidth || figure.scrollWidth > figure.clientWidth,
                clipped:
                  ['hidden', 'clip'].includes(style.overflow) || style.textOverflow === 'ellipsis',
              }
            })
          )
          assert.isTrue(
            measurements.every((item) => !item.overflows && !item.clipped),
            `${width}px ${colorScheme} ${fontSize}: ${JSON.stringify(measurements)}`
          )
          assert.deepEqual(await page.locator('.azu-widget-figure').allTextContents(), original)
          if (width === 1280 && fontSize === '100%') {
            await page.screenshot({
              path: `/private/tmp/azu-u01-${colorScheme}.png`,
              fullPage: true,
            })
          }
        }
      }
    }
    assert.deepEqual(await axeViolations(page), [])
  })
})
