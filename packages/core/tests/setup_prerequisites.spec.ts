import { test } from '@japa/runner'
import type { ApplicationService } from '@adonisjs/core/types'
import type { HttpContext } from '@adonisjs/core/http'
import { InertiaManager } from '@adonisjs/inertia'
import { AdminInertiaMiddleware } from '../src/middleware/admin_inertia_middleware.ts'
import {
  type AppFiles,
  checkPrerequisites,
  registersProvider,
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
const complete: AppFiles = {
  rcFile: RC,
  viteConfig: true,
  viteProviderConfig: true,
  inertiaConfig: true,
  authConfig: AUTH,
}
/** Without config/vite.ts or config/inertia.ts to fall back on */
const noProviderConfigs: AppFiles = { ...complete, viteProviderConfig: false, inertiaConfig: false }

test.group('Setup prerequisites (#63)', () => {
  test('a complete app is missing nothing', ({ assert }) => {
    assert.deepEqual(checkPrerequisites(complete), { missing: [], warnings: [] })
  })

  test('each missing piece, by name', ({ assert }) => {
    const names = (files: Partial<AppFiles>) =>
      checkPrerequisites({ ...complete, ...files }).missing.map((item) => item.name)
    assert.deepEqual(names({ viteConfig: false }), ['vite'])
    assert.deepEqual(
      names({ rcFile: RC.replace(/.*vite_provider.*\n/, ''), viteProviderConfig: false }),
      ['vite']
    )
    assert.deepEqual(names({ rcFile: RC.replace(/.*edge_provider.*\n/, '') }), ['edge'])
    assert.deepEqual(names({ inertiaConfig: false }), ['inertia config'])
    assert.deepEqual(
      names({ rcFile: RC.replace(/.*inertia_provider.*\n/, ''), inertiaConfig: false }),
      ['inertia config', 'inertia provider']
    )
    assert.deepEqual(names({ authConfig: null }), ['session guard'])
    // The API starter kit, as created: no Vite, Edge or Inertia
    assert.deepEqual(
      names({
        rcFile: 'export default defineConfig({ providers: [] })',
        viteConfig: false,
        viteProviderConfig: false,
        inertiaConfig: false,
      }),
      ['vite', 'edge', 'inertia config', 'inertia provider']
    )
  })

  test('finds providers with either quote style and any whitespace inside import()', ({
    assert,
  }) => {
    const doubleQuoted = RC.replaceAll("'", '"')
    const reformatted = `export default defineConfig({
  providers: [
    () =>
      import(
        "@adonisjs/core/providers/edge_provider"
      ),
    {
      file: () => import( '@adonisjs/vite/vite_provider' ),
      environment: ['web'],
    },
    () => import(\`@adonisjs/inertia/inertia_provider\`,
    ),
  ],
})`
    for (const rcFile of [doubleQuoted, reformatted]) {
      assert.deepEqual(checkPrerequisites({ ...noProviderConfigs, inertiaConfig: true, rcFile }), {
        missing: [],
        warnings: [],
      })
    }
  })

  test('a provider is not registered by a near miss or a comment', ({ assert }) => {
    const provider = '@adonisjs/vite/vite_provider'
    assert.isTrue(registersProvider(`() => import('${provider}')`, provider))
    assert.isFalse(registersProvider(`() => import('${provider}")`, provider))
    assert.isFalse(registersProvider(`() => import('${provider}_v2')`, provider))
    assert.isFalse(registersProvider(`// () => import('${provider}'),`, provider))
    assert.isFalse(registersProvider(`'${provider}'`, provider))
    assert.isFalse(registersProvider(null, provider))
  })

  test("warns instead of refusing when a provider isn't found but its config file exists", ({
    assert,
  }) => {
    const rcFile = 'export default defineConfig({ providers: providerList })'
    const { missing, warnings } = checkPrerequisites({ ...complete, rcFile })
    // Edge has no config file to fall back on
    assert.deepEqual(
      missing.map((item) => item.name),
      ['edge']
    )
    assert.lengthOf(warnings, 2)
    assert.include(warnings[0], "Couldn't find @adonisjs/vite/vite_provider")
    assert.include(warnings[0], 'config/vite.ts exists')
    assert.include(warnings[1], "Couldn't find @adonisjs/inertia/inertia_provider")
    assert.include(warnings[1], 'config/inertia.ts exists')
    assert.include(warnings[1], "() => import('@adonisjs/inertia/inertia_provider')")
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
