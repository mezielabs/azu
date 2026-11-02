import { test } from '@japa/runner'
import type { ApplicationService } from '@adonisjs/core/types'
import type { HttpContext } from '@adonisjs/core/http'
import { InertiaManager } from '@adonisjs/inertia'
import { AdminInertiaMiddleware } from '../src/middleware/admin_inertia_middleware.ts'
import {
  type AppFiles,
  missingPrerequisites,
  runtimeSetupProblem,
  sessionGuardToUse,
} from '../src/setup/prerequisites.ts'

const RC = `export default defineConfig({
  providers: [
    () => import('@adonisjs/core/providers/edge_provider'),
    () => import('@adonisjs/vite/vite_provider'),
    () => import('@adonisjs/inertia/inertia_provider'),
  ],
})`
const AUTH = `export default defineConfig({ default: 'web', guards: { web: sessionGuard({}) } })`
const complete: AppFiles = { rcFile: RC, viteConfig: true, inertiaConfig: true, authConfig: AUTH }

test.group('Setup prerequisites (#63)', () => {
  test('a complete app is missing nothing', ({ assert }) => {
    assert.deepEqual(missingPrerequisites(complete), [])
  })

  test('each missing piece, by name', ({ assert }) => {
    const names = (files: Partial<AppFiles>) =>
      missingPrerequisites({ ...complete, ...files }).map((item) => item.name)
    assert.deepEqual(names({ viteConfig: false }), ['vite'])
    assert.deepEqual(names({ rcFile: RC.replace(/.*vite_provider.*\n/, '') }), ['vite'])
    assert.deepEqual(names({ rcFile: RC.replace(/.*edge_provider.*\n/, '') }), ['edge'])
    assert.deepEqual(names({ inertiaConfig: false }), ['inertia config'])
    assert.deepEqual(names({ rcFile: RC.replace(/.*inertia_provider.*\n/, '') }), [
      'inertia provider',
    ])
    assert.deepEqual(names({ authConfig: null }), ['session guard'])
    // The API starter kit, as created: no Vite, Edge or Inertia
    assert.deepEqual(
      names({
        rcFile: 'export default defineConfig({ providers: [] })',
        viteConfig: false,
        inertiaConfig: false,
      }),
      ['vite', 'edge', 'inertia config', 'inertia provider']
    )
  })

  test('the guard to name when the default one is not a session guard', ({ assert }) => {
    assert.isNull(sessionGuardToUse(AUTH))
    assert.equal(
      sessionGuardToUse(
        `defineConfig({ default: 'api', guards: { api: tokensGuard({}), web: sessionGuard({}) } })`
      ),
      'web'
    )
    assert.isNull(
      sessionGuardToUse(`defineConfig({ default: 'api', guards: { api: tokensGuard({}) } })`)
    )
    assert.isNull(sessionGuardToUse(null))
  })
})

test.group('Admin requests without Inertia (#64)', () => {
  function fakeApp(options: { config: boolean; provider: boolean; vite: boolean }) {
    return {
      config: {
        has: () => options.config,
        get: () => (options.config ? { ssr: { enabled: false } } : undefined),
      },
      container: {
        hasBinding: (binding: unknown) =>
          binding === InertiaManager ? options.provider : binding === 'vite' ? options.vite : false,
        make: async () => ({}),
      },
    } as unknown as ApplicationService
  }

  test('names the missing steps instead of throwing a TypeError', async ({ assert }) => {
    const middleware = new AdminInertiaMiddleware(
      fakeApp({ config: false, provider: false, vite: true })
    )
    let next = false
    try {
      await middleware.handle({} as HttpContext, async () => {
        next = true
      })
      assert.fail('expected an error')
    } catch (error: any) {
      assert.equal(error.code, 'E_AZU_SETUP')
      assert.include(error.message, 'Add config/inertia.ts')
      assert.include(error.message, "import('@adonisjs/inertia/inertia_provider')")
      assert.notInclude(error.message, 'Cannot read properties')
    }
    assert.isFalse(next)
  })

  test('each missing piece alone, and nothing when the setup is complete', ({ assert }) => {
    const all = { hasInertiaConfig: true, hasInertiaProvider: true, hasVite: true }
    assert.isNull(runtimeSetupProblem(all))
    assert.include(runtimeSetupProblem({ ...all, hasInertiaConfig: false })!, 'config/inertia.ts')
    assert.include(
      runtimeSetupProblem({ ...all, hasInertiaProvider: false })!,
      '@adonisjs/inertia/inertia_provider'
    )
    assert.include(runtimeSetupProblem({ ...all, hasVite: false })!, 'node ace add @adonisjs/vite')
  })
})
