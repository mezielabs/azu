import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import type { InertiaConfig } from '@adonisjs/inertia/types'
import { createUser } from './helpers.ts'

/**
 * Azu's pages never go through the app's Inertia SSR. The app's SSR
 * bundle (`inertia/ssr.tsx`) renders the app's own pages; asked to
 * render an Azu page, it can't. Azu's Inertia instance copies
 * config/inertia.ts, so it must switch `ssr` off for itself.
 */
test.group("Admin / the app's Inertia SSR", (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('with SSR on for every page, /admin still renders in the browser', async ({
    client,
    assert,
    cleanup,
  }) => {
    const config = app.config.get<InertiaConfig>('inertia')
    const ssr = config.ssr
    config.ssr = { ...ssr, enabled: true, pages: () => true }
    cleanup(() => {
      config.ssr = ssr
    })

    const admin = await createUser('admin')
    const response = await client.get('/admin').loginAs(admin)
    response.assertStatus(200)
    const html = response.text()
    // The page object is in the HTML, for the browser to render...
    const script = /<script data-page="([^"]+)" type="application\/json">([\s\S]*?)<\/script>/.exec(
      html
    )
    assert.isNotNull(script)
    assert.equal(JSON.parse(script![2]).component, 'azu/screen')
    // ...into an empty mount point: nothing was rendered on the server
    assert.include(html, `<div id="${script![1]}"></div>`)
    assert.notInclude(html, 'azu-page-title')
  })
})
