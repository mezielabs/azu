import { assert } from '@japa/assert'
import { apiClient } from '@japa/api-client'
import { inertiaApiClient } from '@adonisjs/inertia/plugins/api_client'
import { sessionApiClient } from '@adonisjs/session/plugins/api_client'
import { authApiClient } from '@adonisjs/auth/plugins/api_client'
import { shieldApiClient } from '@adonisjs/shield/plugins/api_client'
import app from '@adonisjs/core/services/app'
import demo from '#config/demo'
import { runDemoReset } from './demo/helpers.ts'
import type { Config } from '@japa/runner/types'
import { pluginAdonisJS } from '@japa/plugin-adonisjs'
import { dbAssertions } from '@adonisjs/lucid/plugins/db'
import testUtils from '@adonisjs/core/services/test_utils'
import { browserClient } from '@japa/browser-client'
import { authBrowserClient } from '@adonisjs/auth/plugins/browser_client'
import { sessionBrowserClient } from '@adonisjs/session/plugins/browser_client'

/**
 * This file is imported by the "bin/test.ts" entrypoint file
 */

/**
 * Configure Japa plugins in the plugins array.
 * Learn more - https://japa.dev/docs/runner-config#plugins-optional
 */
export const plugins: Config['plugins'] = [
  assert(),
  pluginAdonisJS(app),
  apiClient(),
  inertiaApiClient(app),
  sessionApiClient(app),
  authApiClient(app),
  shieldApiClient(),
  dbAssertions(app),
  // The demo suite checks the DEMO_MODE login page in a browser too
  browserClient({ runInSuites: ['browser', 'demo'] }),
  sessionBrowserClient(app),
  authBrowserClient(app),
]

/**
 * Configure lifecycle function to run before and after all the
 * tests.
 *
 * The setup functions are executed before all the tests
 * The teardown functions are executed after all the tests
 */
export const runnerHooks: Required<Pick<Config, 'setup' | 'teardown'>> = {
  /**
   * Migrate the test database once per run. The returned cleanup rolls
   * the migrations back when the run ends.
   */
  setup: [() => testUtils.db().migrate()],
  teardown: [],
}

/**
 * Configure suites by tapping into the test suite instance.
 * Learn more - https://japa.dev/docs/test-suites#lifecycle-hooks
 */
export const configureSuite: Config['configureSuite'] = (suite) => {
  if (suite.name === 'demo') {
    // The public demo's tests need DEMO_MODE=true (`pnpm test` runs them
    // on their own); skipped in the default run
    if (!demo.enabled) {
      const skip = (test: { skip(skip: boolean, reason: string): unknown }) =>
        test.skip(true, 'Runs with DEMO_MODE=true')
      suite.onTest(skip)
      suite.onGroup((group) => group.tap(skip))
      return
    }
    // Start from what the host runs every hour: a fresh, seeded demo
    suite.setup(async () => {
      const reset = await runDemoReset()
      if (reset.exitCode !== 0) throw reset.error ?? new Error('demo:reset failed')
    })
    return suite.setup(() => testUtils.httpServer().start())
  }
  if (['browser', 'functional', 'e2e'].includes(suite.name)) {
    return suite.setup(() => testUtils.httpServer().start())
  }
}
