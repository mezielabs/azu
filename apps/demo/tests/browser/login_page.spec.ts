import { test } from '@japa/runner'

/**
 * The login page with DEMO_MODE off: a neutral side panel with the docs
 * and GitHub links, and none of the starter kit's copy. tests/demo covers
 * the DEMO_MODE version.
 */
test.group('Login page', () => {
  test('has the docs and GitHub links, no starter-kit copy, and the store title', async ({
    visit,
    assert,
  }) => {
    const page = await visit('/login')

    await page.getByRole('heading', { level: 1, name: 'Welcome back' }).waitFor()
    const docs = page.getByRole('link', { name: 'Azu docs' })
    assert.equal(await docs.getAttribute('href'), 'https://azuadmin.com/docs/')
    const github = page.getByRole('link', { name: 'GitHub' })
    assert.equal(await github.getAttribute('href'), 'https://github.com/mezielabs/azu')

    await page.getByRole('link', { name: 'Azu home' }).waitFor()
    assert.equal(await page.getByRole('link', { name: 'AdonisJS' }).count(), 0)

    assert.equal(await page.getByText(/Feature packs/).count(), 0)
    assert.equal(await page.getByText(/kept intentionally minimal/).count(), 0)
    assert.equal(await page.getByRole('term').count(), 0)
    assert.equal(await page.title(), 'Azu demo store')
  })
})
