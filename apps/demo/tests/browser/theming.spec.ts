import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import type { Page } from 'playwright'
import { createUser } from '../functional/admin/helpers.ts'

/** WCAG 2 contrast between two hex colours */
function contrast(first: string, second: string) {
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5]
      .map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const [light, dark] = [luminance(first), luminance(second)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

const variable = (page: Page, name: string) =>
  page.evaluate(
    (token) =>
      (
        globalThis as unknown as {
          getComputedStyle(e: unknown): { getPropertyValue(n: string): string }
          document: { documentElement: unknown }
        }
      )
        .getComputedStyle((globalThis as any).document.documentElement)
        .getPropertyValue(token)
        .trim(),
    name
  )

const themeAttribute = (page: Page) =>
  page.evaluate(() => (globalThis as any).document.documentElement.getAttribute('data-azu-theme'))

/**
 * The demo's brand (config/admin.ts) drives the palettes, the header
 * and the page title, and dark mode follows the OS with a toggle that
 * this browser remembers (FR-14).
 */
test.group('Theming (FR-14)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test("the brand's palettes, name and logo come from config/admin.ts", async ({
    visit,
    browserContext,
    assert,
  }) => {
    await browserContext.loginAs(await createUser('admin'))
    const page = await visit('/admin/resources/products')
    await page.waitForSelector('.azu-main')

    // brand.color is #0d9488, 3.7:1 on white: the light palette darkens it
    // to reach 4.5:1, and the dark one keeps or lightens it
    const light = await variable(page, '--azu-brand')
    assert.notEqual(light, '#2563eb')
    assert.isAtLeast(contrast(light, await variable(page, '--azu-surface')), 4.5)
    await page.emulateMedia({ colorScheme: 'dark' })
    const dark = await variable(page, '--azu-brand')
    assert.notEqual(dark, light)
    assert.isAtLeast(contrast(dark, await variable(page, '--azu-surface')), 4.5)

    assert.equal(await page.title(), 'Products · Azu Store')
    const brand = page.locator('.azu-sidebar .azu-brand')
    assert.equal(await brand.innerText(), 'Azu Store')
    assert.equal(await brand.locator('img').getAttribute('src'), '/images/logo.svg')
  })

  test('dark mode follows the OS until toggled, and the toggle is remembered', async ({
    visit,
    browserContext,
    assert,
  }) => {
    await browserContext.loginAs(await createUser('admin'))
    const page = await visit('/admin')
    await page.emulateMedia({ colorScheme: 'light' })
    // An icon button labelled by what it does
    const sidebar = page.locator('.azu-sidebar')
    const toDark = sidebar.getByRole('button', { name: 'Switch to dark theme' })
    await toDark.waitFor()
    assert.equal(await variable(page, '--azu-surface'), '#ffffff')

    await toDark.click()
    await sidebar.getByRole('button', { name: 'Switch to light theme' }).waitFor()
    assert.equal(await themeAttribute(page), 'dark')
    assert.equal(await variable(page, '--azu-surface'), '#09090b')

    // Remembered across loads in this browser, before the first paint
    await page.reload()
    await page.waitForSelector('.azu-main')
    assert.equal(await themeAttribute(page), 'dark')
    assert.equal(await variable(page, '--azu-surface'), '#09090b')

    // Toggling back to the OS's theme follows the OS again
    await sidebar.getByRole('button', { name: 'Switch to light theme' }).click()
    assert.isNull(await themeAttribute(page))
    assert.isNull(await page.evaluate(() => (globalThis as any).localStorage.getItem('azu-theme')))
    await page.emulateMedia({ colorScheme: 'dark' })
    assert.equal(await variable(page, '--azu-surface'), '#09090b')
    // The toggle hears the OS change, and now offers the light theme
    await sidebar.getByRole('button', { name: 'Switch to light theme' }).waitFor({ timeout: 5000 })
  })
})
