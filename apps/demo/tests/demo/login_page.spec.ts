import { test } from '@japa/runner'

/**
 * The public demo's login page (DEMO_MODE), in a browser: the heading,
 * what each role sees, and none of the starter kit's copy.
 */
test.group('Demo / login page', () => {
  test('shows the roles, the docs and GitHub links, and the demo title', async ({
    visit,
    assert,
  }) => {
    const page = await visit('/login')

    await page.getByRole('heading', { level: 1, name: 'Try Azu' }).waitFor()
    await page
      .getByText('Sign in as a role to see how the same panel changes with your Bouncer policies.')
      .waitFor()
    for (const role of ['Admin', 'Editor', 'Viewer']) {
      await page.getByRole('button', { name: `Sign in as ${role}`, exact: true }).waitFor()
    }

    const roles = page.getByRole('definition')
    assert.deepEqual(await page.getByRole('term').allInnerTexts(), ['Admin', 'Editor', 'Viewer'])
    assert.deepEqual(await roles.allInnerTexts(), [
      'Everything, including Delete, Publish, and user roles.',
      'Edits products, with no Delete or Publish. Some resources are hidden.',
      "Looks around, and can't change anything.",
    ])

    const docs = page.getByRole('link', { name: 'Azu docs' })
    assert.equal(await docs.getAttribute('href'), 'https://azuadmin.com/docs/')
    const github = page.getByRole('link', { name: 'GitHub' })
    assert.equal(await github.getAttribute('href'), 'https://github.com/mezielabs/azu')

    assert.equal(await page.getByText(/Feature packs/).count(), 0)
    assert.equal(await page.getByText(/Create an account/).count(), 0)
    assert.equal(await page.title(), 'Azu demo')
  })
})
