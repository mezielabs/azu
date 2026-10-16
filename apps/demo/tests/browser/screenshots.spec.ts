import { mkdir } from 'node:fs/promises'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import MainSeeder from '#database/seeders/main_seeder'
import Product from '#models/product'
import User from '#models/user'

const OUT = app.makePath('../../docs/screenshots')

/**
 * The README's screenshots, from the seeded demo: `pnpm screenshots`.
 * Skipped in the normal test run, so tests never write to docs/.
 */
test.group('README screenshots', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('captures the list, the form and dark mode', async ({ browser }) => {
    await new MainSeeder(db.connection()).run()
    await mkdir(OUT, { recursive: true })
    const admin = await User.findByOrFail('role', 'admin')
    const product = await Product.findByOrFail('sku', 'SKU-0007')

    for (const colorScheme of ['light', 'dark'] as const) {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 2,
        colorScheme,
        baseURL: `http://${process.env.HOST}:${process.env.PORT}`,
      })
      await context.loginAs(admin)

      const list = await context.newPage()
      await list.goto('/admin/resources/products')
      await list.locator('.azu-thumbnail').nth(3).waitFor()
      await list.evaluate(() => (globalThis as any).document.fonts.ready)
      await list.screenshot({ path: `${OUT}/list-${colorScheme}.png` })

      const form = await context.newPage()
      await form.goto(`/admin/resources/products/${product.id}/edit`)
      await form.locator('[data-azu-field="tags"] [role="row"]').first().waitFor()
      // The rich text editor loads lazily
      await form.locator('[data-azu-field="description"] [contenteditable="true"]').waitFor()
      await form.evaluate(() => (globalThis as any).document.fonts.ready)
      await form.screenshot({ path: `${OUT}/form-${colorScheme}.png` })

      await context.close()
    }
  })
    .skip(!process.env.AZU_SCREENSHOTS, 'Run with pnpm screenshots')
    .timeout(120_000)
})
