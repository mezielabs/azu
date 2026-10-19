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
 * The demo's brand (config/azu.ts) drives the palettes, the header
 * and the page title, and dark mode follows the OS with a toggle that
 * this browser remembers (FR-14).
 */
test.group('Theming (FR-14)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test("the brand's palettes, name and logo come from config/azu.ts", async ({
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

  test('the theme follows the OS (System) until Light or Dark is chosen, and remembers it', async ({
    visit,
    browserContext,
    assert,
  }) => {
    const admin = await createUser('admin')
    await browserContext.loginAs(admin)
    const page = await visit('/admin')
    await page.emulateMedia({ colorScheme: 'light' })
    const choose = async (name: 'Light' | 'Dark' | 'System') => {
      await page.getByRole('button', { name: `Account: ${admin.fullName}` }).click()
      await page.getByRole('menu', { name: 'Account' }).getByRole('menuitemradio', { name }).click()
      await page.getByRole('menu', { name: 'Account' }).waitFor({ state: 'detached' })
    }
    const checked = async () => {
      await page.getByRole('button', { name: `Account: ${admin.fullName}` }).click()
      const item = page.getByRole('menu', { name: 'Account' }).locator('[aria-checked="true"]')
      const name = await item.innerText()
      await page.keyboard.press('Escape')
      return name.trim()
    }
    const stored = () => page.evaluate(() => (globalThis as any).localStorage.getItem('azu-theme'))

    // Nothing stored: System, following the OS
    assert.equal(await checked(), 'System')
    assert.equal(await variable(page, '--azu-surface'), '#ffffff')

    await choose('Dark')
    assert.equal(await themeAttribute(page), 'dark')
    assert.equal(await stored(), 'dark')
    assert.equal(await variable(page, '--azu-surface'), '#09090b')

    // Remembered across loads in this browser, before the first paint
    await page.reload()
    await page.waitForSelector('.azu-main')
    assert.equal(await themeAttribute(page), 'dark')
    assert.equal(await variable(page, '--azu-surface'), '#09090b')
    assert.equal(await checked(), 'Dark')

    // Light holds even when the OS goes dark
    await choose('Light')
    await page.emulateMedia({ colorScheme: 'dark' })
    assert.equal(await variable(page, '--azu-surface'), '#ffffff')

    // System forgets the choice and follows the OS, live
    await choose('System')
    assert.isNull(await themeAttribute(page))
    assert.isNull(await stored())
    assert.equal(await variable(page, '--azu-surface'), '#09090b')
    await page.emulateMedia({ colorScheme: 'light' })
    assert.equal(await variable(page, '--azu-surface'), '#ffffff')
    await page.emulateMedia({ colorScheme: 'dark' })
    assert.equal(await variable(page, '--azu-surface'), '#09090b')
  })

  test("the progress bar is the theme's brand colour", async ({
    visit,
    browserContext,
    assert,
  }) => {
    await browserContext.loginAs(await createUser('admin'))
    const page = await visit('/admin')
    await page.locator('.azu-main').waitFor()
    // Inertia writes its bar's styles once, with the colour it was given
    const css = await page.evaluate(() =>
      [...(globalThis as any).document.querySelectorAll('style')]
        .map((style: any) => style.textContent)
        .join('\n')
    )
    assert.include(css, 'var(--azu-brand)')
    assert.notInclude(css, '#29d')
  })
})
