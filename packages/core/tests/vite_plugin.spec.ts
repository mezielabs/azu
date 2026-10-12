import { test } from '@japa/runner'
import { resolveConfig, type ResolvedConfig } from 'vite'
import adonisjs from '@adonisjs/vite/client'
import { azu } from '../src/vite/plugin.ts'

function clientInput(config: ResolvedConfig) {
  return config.environments.client.build.rolldownOptions.input
}

test.group('azu() Vite plugin', (group) => {
  group.each.setup(async ({ context }) => {
    await context.fs.createJson('package.json', { name: 'app', type: 'module' })
  })

  test('adds the admin entry and keeps the app entries', async ({ assert, fs }) => {
    const config = await resolveConfig(
      {
        root: fs.basePath,
        configFile: false,
        plugins: [adonisjs({ entryPoints: ['inertia/app.tsx'] }), azu()],
      },
      'build'
    )

    assert.sameMembers(clientInput(config) as string[], [
      'inertia/app.tsx',
      'inertia/admin/app.tsx',
    ])
  })

  test('works when listed before the AdonisJS plugin', async ({ assert, fs }) => {
    const config = await resolveConfig(
      {
        root: fs.basePath,
        configFile: false,
        plugins: [azu(), adonisjs({ entryPoints: ['inertia/app.tsx'] })],
      },
      'build'
    )

    assert.sameMembers(clientInput(config) as string[], [
      'inertia/app.tsx',
      'inertia/admin/app.tsx',
    ])
  })

  test('dedupes the peer dependencies of the installed front-end package', async ({
    assert,
    fs,
  }) => {
    await fs.createJson('node_modules/@mezielabs/azu-react/package.json', {
      name: '@mezielabs/azu-react',
      peerDependencies: {
        '@inertiajs/react': '^3.0.0',
        '@mezielabs/azu': '^0.0.0',
        'react': '^19.0.0',
        'react-dom': '^19.0.0',
      },
    })

    const config = await resolveConfig(
      { root: fs.basePath, configFile: false, plugins: [azu()] },
      'serve'
    )

    assert.includeMembers(config.resolve.dedupe, ['@inertiajs/react', 'react', 'react-dom'])
    assert.notInclude(config.resolve.dedupe, '@mezielabs/azu')
  })

  test('dedupes nothing extra when no front-end package is installed', async ({ assert, fs }) => {
    const config = await resolveConfig(
      { root: fs.basePath, configFile: false, plugins: [azu()] },
      'serve'
    )

    assert.notInclude(config.resolve.dedupe, 'react')
  })

  test('accepts a custom entry and dedupe list', async ({ assert, fs }) => {
    const config = await resolveConfig(
      {
        root: fs.basePath,
        configFile: false,
        plugins: [
          adonisjs({ entryPoints: ['inertia/app.tsx'] }),
          azu({ entry: 'resources/admin.tsx', dedupe: ['preact'] }),
        ],
      },
      'build'
    )

    assert.sameMembers(clientInput(config) as string[], ['inertia/app.tsx', 'resources/admin.tsx'])
    assert.include(config.resolve.dedupe, 'preact')
  })
})
