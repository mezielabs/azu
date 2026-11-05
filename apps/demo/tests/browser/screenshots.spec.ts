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
 * The README's and the docs' screenshots, from the seeded demo on Postgres:
 * `pnpm screenshots` with `DB_CONNECTION=pg` and the `DB_*` settings.
 * Skipped in the normal test run, so tests never write to docs/.
 */
test.group('Screenshots', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('captures the list, the form, the phone list and dark mode', async ({ browser }) => {
    // Postgres, the primary database: SQLite returns decimals as numbers,
    // so the form would show a price of 3250 rather than 3250.00
    if (db.connection().dialect.name !== 'postgres') {
      throw new Error('Capture the screenshots on Postgres: DB_CONNECTION=pg, see CLAUDE.md')
    }
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

      // The form's card alone, for the docs landing page. A viewport tall
      // enough for the whole card keeps the sticky action bar off it.
      const card = await context.newPage()
      await card.setViewportSize({ width: 1280, height: 2400 })
      await card.goto(`/admin/resources/products/${product.id}/edit`)
      await card.locator('[data-azu-field="tags"] [role="row"]').first().waitFor()
      await card.locator('[data-azu-field="description"] [contenteditable="true"]').waitFor()
      await card.evaluate(() => (globalThis as any).document.fonts.ready)
      await card
        .locator('.azu-form-body')
        .screenshot({ path: `${OUT}/form-card-${colorScheme}.png` })

      await context.close()

      // The list on a phone: cards, with Sort and Select records
      const phone = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        colorScheme,
        baseURL: `http://${process.env.HOST}:${process.env.PORT}`,
      })
      await phone.loginAs(admin)

      const cards = await phone.newPage()
      await cards.goto('/admin/resources/products')
      await cards.locator('.azu-list-cards .azu-card').nth(3).waitFor()
      await cards.locator('.azu-mobile-sort').waitFor()
      await cards.evaluate(async () => {
        const doc = (globalThis as any).document
        await doc.fonts.ready
        await Promise.all([...doc.images].map((img: any) => img.decode().catch(() => {})))
      })
      await cards.screenshot({ path: `${OUT}/list-phone-${colorScheme}.png` })

      await phone.close()
    }
  })
    .skip(!process.env.AZU_SCREENSHOTS, 'Run with pnpm screenshots')
    .timeout(120_000)
})
