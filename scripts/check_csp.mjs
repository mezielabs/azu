/**
 * The admin panel under a strict, nonce-only Content Security Policy
 * (#65), on the demo's production build: no CSP violations on the
 * Overview, a list (and the held column widths of an empty one), a row
 * menu, an action dialog, and a form with the rich text editor.
 *
 * Needs `node ace build` in apps/demo, a seeded database the build can
 * read, and Playwright's Chromium. Starts the build itself with
 * NODE_ENV=production and STRICT_CSP=true.
 *
 * Usage: node scripts/check_csp.mjs [port]
 */
import { spawn } from 'node:child_process'
import { copyFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { setTimeout as sleep } from 'node:timers/promises'

const demo = new URL('../apps/demo/', import.meta.url)
const { chromium } = createRequire(new URL('package.json', demo))('playwright')
const port = Number(process.argv[2] ?? 3335)
const base = `http://localhost:${port}`
const email = process.env.BENCH_EMAIL ?? 'admin@azu.test'
const password = process.env.BENCH_PASSWORD ?? 'password'

// The build reads .env, and SQLite's file, from its own folder
const build = new URL('build/', demo)
if (!existsSync(new URL('.env', build)))
  await copyFile(new URL('.env', demo), new URL('.env', build))
if (existsSync(new URL('tmp/db.sqlite3', demo))) {
  await mkdir(new URL('tmp/', build), { recursive: true })
  await copyFile(new URL('tmp/db.sqlite3', demo), new URL('tmp/db.sqlite3', build))
}

const server = spawn('node', ['bin/server.js'], {
  cwd: build,
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(port),
    HOST: 'localhost',
    STRICT_CSP: 'true',
    LOG_LEVEL: 'warn',
  },
  stdio: ['ignore', 'inherit', 'inherit'],
})

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(`${base}/login`)
      if (response.ok) return response
    } catch {}
    await sleep(500)
  }
  throw new Error(`The demo didn't start on ${base}`)
}

const violations = []
let browser
try {
  const login = await waitForServer()
  const policy = login.headers.get('content-security-policy') ?? ''
  if (!policy.includes("'nonce-") || policy.includes('unsafe-inline')) {
    throw new Error(`Expected a strict nonce policy, got: ${policy || 'none'}`)
  }

  browser = await chromium.launch()
  const page = await browser.newPage()
  // Recorded in every document, before the page's own scripts run
  await page.addInitScript(() => {
    window.__violations = []
    document.addEventListener('securitypolicyviolation', (event) => {
      window.__violations.push(
        `${event.violatedDirective} ${event.blockedURI || 'inline'} ${event.sourceFile ?? ''}`
      )
    })
  })
  const collect = async (step) => {
    const found = await page.evaluate(() => window.__violations.splice(0))
    for (const item of found) violations.push(`${step}: ${item}`)
    console.log(`${found.length === 0 ? 'ok  ' : 'FAIL'} ${step}`)
  }

  await page.goto(`${base}/login`)
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.waitForURL(/\/(admin|dashboard)/)

  await page.goto(`${base}/admin`)
  await page.getByRole('heading', { level: 1, name: 'Overview' }).waitFor()
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.azu-widget')].every(
      (card) => card.dataset.azuState !== 'loading'
    )
  )
  await collect('Overview')

  await page.goto(`${base}/admin/resources/products`)
  await page.getByRole('grid', { name: 'Products' }).waitFor()
  await collect('list')

  // An empty result holds the columns' widths in a stylesheet
  const search = page.getByRole('searchbox', { name: 'Search products' })
  await search.fill('no product has this name')
  await search.press('Enter')
  await page.locator('.azu-table-empty').waitFor()
  await page.locator('.azu-table[data-azu-held]').waitFor()
  await collect('empty list, held column widths')

  await page.goto(`${base}/admin/resources/products`)
  await page.locator('[aria-label^="Actions for"]').first().click()
  await page.getByRole('menu').waitFor()
  await collect('row menu')

  await page.getByRole('menuitem', { name: 'Restock' }).click()
  await page.getByRole('alertdialog').getByLabel('Quantity').waitFor()
  await collect('action dialog')
  await page.keyboard.press('Escape')

  // The seeder's first product
  await page.goto(`${base}/admin/resources/products/1/edit`)
  await page.locator('.azu-rich-text-content').waitFor()
  await collect('form with the rich text editor')
} finally {
  await browser?.close()
  server.kill()
}

if (violations.length > 0) {
  console.error(`\n${violations.length} CSP violation(s) under ${base}:`)
  for (const item of violations) console.error(`  ${item}`)
  process.exit(1)
}
console.log('\nNo CSP violations under a strict nonce policy')
