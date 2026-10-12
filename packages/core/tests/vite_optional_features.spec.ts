import { test } from '@japa/runner'
import { build, resolveConfig, type ResolvedConfig } from 'vite'
import type { FileSystem } from '@japa/file-system'
import { azu } from '../src/vite/plugin.ts'

const FEATURE = '@mezielabs/azu-react/feature'
const FALLBACK = '@mezielabs/azu-react/fallback'

/**
 * A front-end package with one optional feature that needs `fixture-peer`,
 * plus an app entry that lazily imports the feature.
 */
async function createApp(fs: FileSystem) {
  await fs.createJson('package.json', { name: 'app', type: 'module' })
  await fs.create('main.js', `import('${FEATURE}').then((mod) => console.log(mod.default))\n`)
  await fs.createJson('node_modules/@mezielabs/azu-react/package.json', {
    name: '@mezielabs/azu-react',
    type: 'module',
    exports: { './feature': './feature.js', './fallback': './fallback.js' },
    peerDependencies: { 'fixture-peer': '^1.0.0' },
    azu: {
      optimizeDeps: ['fixture-dependency'],
      optionalFeatures: [
        {
          name: 'fixture feature',
          specifier: FEATURE,
          fallback: FALLBACK,
          requires: ['fixture-peer', 'fixture-peer-extra'],
          optimizeDeps: ['fixture-peer'],
        },
      ],
    },
  })
  await fs.create(
    'node_modules/@mezielabs/azu-react/feature.js',
    `import peer from 'fixture-peer'\nexport default 'real feature with ' + peer\n`
  )
  await fs.create(
    'node_modules/@mezielabs/azu-react/fallback.js',
    `export default 'fallback feature'\n`
  )
}

async function installPeer(fs: FileSystem, name: string) {
  await fs.createJson(`node_modules/${name}/package.json`, {
    name,
    type: 'module',
    exports: './index.js',
  })
  await fs.create(`node_modules/${name}/index.js`, `export default '${name}'\n`)
}

function hasAlias(config: ResolvedConfig) {
  return config.resolve.alias.some(
    (alias) => alias.find === FEATURE && alias.replacement === FALLBACK
  )
}

/**
 * Runs a real production build of the fixture app and returns the
 * emitted JavaScript.
 */
async function buildApp(fs: FileSystem, withAzu = true) {
  const output = await build({
    root: fs.basePath,
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      ...(withAzu ? {} : { rolldownOptions: { input: 'main.js' } }),
    },
    plugins: withAzu ? [azu({ entry: 'main.js', dedupe: [] })] : [],
  })
  const results = Array.isArray(output) ? output : [output]
  return results
    .flatMap((result) => ('output' in result ? result.output : []))
    .map((chunk) => ('code' in chunk ? chunk.code : ''))
    .join('\n')
}

test.group('azu() optional features', (group) => {
  group.each.timeout(20_000)
  group.each.setup(async ({ context }) => {
    await createApp(context.fs)
  })

  test('aliases a feature to its fallback when its peers are missing', async ({ assert, fs }) => {
    const config = await resolveConfig(
      { root: fs.basePath, configFile: false, plugins: [azu()] },
      'serve'
    )

    assert.isTrue(hasAlias(config))
    assert.include(config.optimizeDeps.include, '@mezielabs/azu-react > fixture-dependency')
    assert.notInclude(config.optimizeDeps.include, 'fixture-peer')
  })

  test('uses the real feature and pre-bundles its peers when all peers are installed', async ({
    assert,
    fs,
  }) => {
    await installPeer(fs, 'fixture-peer')
    await installPeer(fs, 'fixture-peer-extra')
    const config = await resolveConfig(
      { root: fs.basePath, configFile: false, plugins: [azu()] },
      'serve'
    )

    assert.isFalse(hasAlias(config))
    assert.includeMembers(config.optimizeDeps.include ?? [], [
      '@mezielabs/azu-react > fixture-dependency',
      'fixture-peer',
    ])
  })

  test('falls back when only some of the required peers are installed', async ({ assert, fs }) => {
    await installPeer(fs, 'fixture-peer')
    const config = await resolveConfig(
      { root: fs.basePath, configFile: false, plugins: [azu()] },
      'serve'
    )

    assert.isTrue(hasAlias(config))
  })

  test('without azu(), the build fails on the missing peer', async ({ assert, fs }) => {
    await assert.rejects(() => buildApp(fs, false), /fixture-peer/)
  })

  test('with azu() and no peers, the build succeeds using the fallback', async ({ assert, fs }) => {
    const code = await buildApp(fs)

    assert.include(code, 'fallback feature')
    assert.notInclude(code, 'real feature with')
  })

  test('with the peers installed, the build bundles the real feature', async ({ assert, fs }) => {
    await installPeer(fs, 'fixture-peer')
    await installPeer(fs, 'fixture-peer-extra')
    const code = await buildApp(fs)

    assert.include(code, 'real feature with')
    assert.notInclude(code, 'fallback feature')
  })

  test('adds nothing when no front-end package is installed', async ({ assert, fs }) => {
    await fs.remove('node_modules/@mezielabs')
    const config = await resolveConfig(
      { root: fs.basePath, configFile: false, plugins: [azu()] },
      'serve'
    )

    assert.isFalse(hasAlias(config))
    assert.deepEqual(config.optimizeDeps.include ?? [], [])
  })
})
