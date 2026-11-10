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

    // Azu's mark, not the starter kit's AdonisJS logo
    await page.getByRole('link', { name: 'Azu home' }).waitFor()
    assert.equal(await page.getByRole('link', { name: 'AdonisJS' }).count(), 0)

    assert.equal(await page.getByText(/Feature packs/).count(), 0)
    assert.equal(await page.getByText(/Create an account/).count(), 0)
    assert.equal(await page.title(), 'Azu demo')
  })

  test('on a phone, the roles sit below the buttons', async ({ visit, assert }) => {
    const page = await visit('/login')
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('heading', { level: 1, name: 'Try Azu' }).waitFor()

    // The right panel is hidden, so the list below the buttons shows instead
    await page.locator('.demo-sign-in__roles').waitFor()
    const roles = page.getByRole('definition')
    assert.deepEqual(await page.getByRole('term').allInnerTexts(), ['Admin', 'Editor', 'Viewer'])
    assert.lengthOf(await roles.all(), 3)
    assert.isFalse(await page.locator('.auth__aside').isVisible())

    const viewer = page.getByRole('button', { name: 'Sign in as Viewer', exact: true })
    const list = page.locator('.demo-sign-in__roles')
    const [buttonBox, listBox] = [await viewer.boundingBox(), await list.boundingBox()]
    assert.isAbove(listBox!.y, buttonBox!.y)
    // Short enough that the email form still starts on the first screen
    const email = await page.getByLabel('Email', { exact: true }).boundingBox()
    assert.isBelow(email!.y, 844)
  })
})
