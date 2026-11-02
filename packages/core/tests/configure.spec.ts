import { test } from '@japa/runner'
import { IgnitorFactory } from '@adonisjs/core/factories'
import Configure from '@adonisjs/core/commands/configure'
import type { FileSystem } from '@japa/file-system'

const PACKAGE_ENTRY = new URL('../index.ts', import.meta.url).href

type Piece =
  'vite provider' | 'vite config' | 'edge' | 'inertia config' | 'inertia provider' | 'session guard'

const SESSION_AUTH = `import { defineConfig } from '@adonisjs/auth'
import { sessionGuard, sessionUserProvider } from '@adonisjs/auth/session'

export default defineConfig({
  default: 'web',
  guards: {
    web: sessionGuard({ provider: sessionUserProvider({ model: () => import('#models/user') }) }),
  },
})
`

/** The API starter kit's: access tokens by default, a session guard beside it */
const TOKENS_AUTH = `export default defineConfig({
  default: 'api',
  guards: {
    api: tokensGuard({ provider: tokensUserProvider({ tokens: 'accessTokens' }) }),
    web: sessionGuard({ provider: sessionUserProvider({ model: () => import('#models/user') }) }),
  },
})
`

/**
 * A minimal app on disk with a booted container, so the real Configure
 * command runs the hook and its codemods.
 */
async function createApp(
  fs: FileSystem,
  viteConfig: string,
  dependencies: Record<string, string> = {},
  without: Piece[] = [],
  authConfig = SESSION_AUTH
) {
  const providers = [
    without.includes('edge') ? null : `() => import('@adonisjs/core/providers/edge_provider')`,
    without.includes('vite provider') ? null : `() => import('@adonisjs/vite/vite_provider')`,
    without.includes('inertia provider')
      ? null
      : `() => import('@adonisjs/inertia/inertia_provider')`,
  ].filter(Boolean)
  await fs.create('.env', '')
  await fs.createJson('tsconfig.json', {})
  await fs.createJson('package.json', { name: 'app', type: 'module', dependencies })
  await fs.create(
    'adonisrc.ts',
    `export default defineConfig({\n  providers: [${providers.join(', ')}],\n})`
  )
  if (!without.includes('vite config')) await fs.create('vite.config.ts', viteConfig)
  if (!without.includes('inertia config')) {
    await fs.create('config/inertia.ts', `export default defineConfig({ ssr: { enabled: false } })`)
  }
  await fs.create(
    'config/auth.ts',
    without.includes('session guard')
      ? authConfig.replace(/sessionGuard/g, 'tokensGuard')
      : authConfig
  )

  const ignitor = new IgnitorFactory()
    .withCoreProviders()
    .withCoreConfig()
    .create(fs.baseUrl, { importer: (filePath) => import(filePath) })

  const app = ignitor.createApp('console')
  await app.init()
  await app.boot()

  const ace = await app.container.make('ace')
  ace.ui.switchMode('raw')
  return ace
}

test.group('configure', (group) => {
  /**
   * Each test boots an app and loads ts-morph, which is slow on a cold
   * start and under coverage
   */
  group.each.timeout(30_000)

  test('writes config and the admin entry, registers the provider and Vite plugin', async ({
    assert,
    fs,
  }) => {
    const ace = await createApp(
      fs,
      [
        `import { defineConfig } from 'vite'`,
        `import adonisjs from '@adonisjs/vite/client'`,
        ``,
        `export default defineConfig({`,
        `  plugins: [adonisjs({ entryPoints: ['inertia/app.tsx'] })],`,
        `})`,
      ].join('\n')
    )

    const command = await ace.create(Configure, [PACKAGE_ENTRY, '--no-install'])
    await command.exec()
    command.assertSucceeded()

    await assert.fileContains('config/azu.ts', `import { defineConfig } from '@mezielabs/azu'`)
    await assert.fileContains('config/azu.ts', `path: '/admin'`)
    await assert.fileContains('inertia/admin/app.tsx', `createAzuApp({`)
    await assert.fileContains('adonisrc.ts', `@mezielabs/azu/azu_provider`)
    await assert.fileContains('adonisrc.ts', `@mezielabs/azu/commands`)
    await assert.fileContains('vite.config.ts', `import { azu } from '@mezielabs/azu/vite'`)
    await assert.fileContains('vite.config.ts', `azu()`)
    await assert.fileContains('config/azu.ts', `resources: { autoload: 'app/admin/resources' }`)
    await assert.fileContains('start/azu.ts', `azu.register(productResource)`)
    await assert.fileContains('adonisrc.ts', `#start/azu`)
    const pkg = await fs.contentsJson('package.json')
    assert.equal(pkg.imports['#admin/*'], './app/admin/*.js')

    // Generated files end with a newline, as Prettier expects
    const azuConfig = await fs.contents('config/azu.ts')
    const adminEntry = await fs.contents('inertia/admin/app.tsx')
    assert.isTrue(azuConfig.endsWith('azuConfig\n'))
    assert.isTrue(adminEntry.endsWith('})\n'))
  })

  test('keeps an existing config file', async ({ assert, fs }) => {
    await fs.create('config/azu.ts', `// mine`)
    const ace = await createApp(fs, `export default { plugins: [] }`)

    const command = await ace.create(Configure, [PACKAGE_ENTRY, '--no-install'])
    await command.exec()

    assert.equal(await fs.contents('config/azu.ts'), `// mine`)
  })
})

test.group('configure / accessAdmin ability (FR-02)', (group) => {
  group.each.timeout(30_000)

  /**
   * What `node ace configure @adonisjs/bouncer` writes
   */
  const BOUNCER_ABILITIES = [
    `import { Bouncer } from '@adonisjs/bouncer'`,
    ``,
    `export const editUser = Bouncer.ability(() => {`,
    `  return true`,
    `})`,
    ``,
  ].join('\n')

  test('adds accessAdmin, returning false, to the abilities file', async ({ assert, fs }) => {
    await fs.create('app/abilities/main.ts', BOUNCER_ABILITIES)
    const ace = await createApp(fs, `export default { plugins: [] }`)

    const command = await ace.create(Configure, [PACKAGE_ENTRY, '--no-install'])
    await command.exec()
    command.assertSucceeded()

    const abilities = await fs.contents('app/abilities/main.ts')
    assert.include(abilities, 'export const editUser')
    assert.include(
      abilities,
      'export const accessAdmin = Bouncer.ability(() => {\n  return false\n})'
    )
    assert.equal(abilities.match(/from '@adonisjs\/bouncer'/g)?.length, 1)
    assert.isTrue(abilities.endsWith('})\n'))
  })

  test('keeps an existing accessAdmin ability', async ({ assert, fs }) => {
    const mine = `import { Bouncer } from '@adonisjs/bouncer'\n\nexport const accessAdmin = Bouncer.ability(() => true)\n`
    await fs.create('app/abilities/main.ts', mine)
    const ace = await createApp(fs, `export default { plugins: [] }`)

    const command = await ace.create(Configure, [PACKAGE_ENTRY, '--no-install'])
    await command.exec()

    assert.equal(await fs.contents('app/abilities/main.ts'), mine)
  })

  test('adds the Bouncer import when the abilities file lacks it', async ({ assert, fs }) => {
    await fs.create('app/abilities/main.ts', `export {}\n`)
    const ace = await createApp(fs, `export default { plugins: [] }`)

    const command = await ace.create(Configure, [PACKAGE_ENTRY, '--no-install'])
    await command.exec()

    const abilities = await fs.contents('app/abilities/main.ts')
    assert.isTrue(abilities.startsWith(`import { Bouncer } from '@adonisjs/bouncer'\n`))
    assert.include(abilities, 'export const accessAdmin')
  })

  test('without Bouncer, creates no abilities file and explains how to add it', async ({
    assert,
    fs,
  }) => {
    const ace = await createApp(fs, `export default { plugins: [] }`)

    const command = await ace.create(Configure, [PACKAGE_ENTRY, '--no-install'])
    await command.exec()
    command.assertSucceeded()

    assert.isFalse(await fs.exists('app/abilities/main.ts'))
    const logs = ace.ui.logger.getLogs().map((log) => log.message)
    assert.isTrue(logs.some((message) => message.includes('node ace add @adonisjs/bouncer')))
  })

  test("doesn't ask to install @mezielabs/azu-react when the app already lists it", async ({
    assert,
    fs,
  }) => {
    const ace = await createApp(
      fs,
      `import { defineConfig } from 'vite'\n\nexport default defineConfig({ plugins: [] })`,
      { '@mezielabs/azu-react': 'file:../mezielabs-azu-react-0.1.0.tgz' }
    )

    // No --install or --no-install: an untrapped prompt would fail the test
    const command = await ace.create(Configure, [PACKAGE_ENTRY])
    await command.exec()

    command.assertSucceeded()
    const logs = command.logger.getLogs().map((log) => log.message)
    assert.notInclude(logs.join('\n'), 'Please install')
    await assert.fileExists('config/azu.ts')
  })
})

test.group('configure / prerequisites (#63)', (group) => {
  group.each.timeout(30_000)

  const VITE = `export default { plugins: [] }`

  /** Nothing written: no config, no admin entry, adonisrc untouched */
  async function assertNothingWritten(fs: FileSystem, assert: any, rcBefore: string) {
    assert.isFalse(await fs.exists('config/azu.ts'))
    assert.isFalse(await fs.exists('start/azu.ts'))
    assert.isFalse(await fs.exists('inertia/admin/app.tsx'))
    assert.equal(await fs.contents('adonisrc.ts'), rcBefore)
  }

  for (const [pieces, expected] of [
    [['vite provider'], 'node ace add @adonisjs/vite'],
    [['vite config'], 'node ace add @adonisjs/vite'],
    [['edge'], 'node ace add edge'],
    [['inertia config'], 'Add config/inertia.ts'],
    [['inertia provider'], "import('@adonisjs/inertia/inertia_provider')"],
    [['session guard'], 'Add a session guard to config/auth.ts'],
  ] as [Piece[], string][]) {
    test(`without ${pieces.join(', ')}: writes nothing, fails, and says what to add`, async ({
      assert,
      fs,
    }) => {
      const ace = await createApp(fs, VITE, {}, pieces)
      const rcBefore = await fs.contents('adonisrc.ts')

      const command = await ace.create(Configure, [PACKAGE_ENTRY, '--no-install'])
      await command.exec()

      assert.equal(command.exitCode, 1)
      await assertNothingWritten(fs, assert, rcBefore)
      const logs = ace.ui.logger
        .getLogs()
        .map((log) => log.message)
        .join('\n')
      assert.include(logs, 'Nothing was changed')
      assert.include(logs, expected)
    })
  }

  test('the Hypermedia kit: names both Inertia steps', async ({ assert, fs }) => {
    const ace = await createApp(fs, VITE, {}, ['inertia config', 'inertia provider'])
    const rcBefore = await fs.contents('adonisrc.ts')

    const command = await ace.create(Configure, [PACKAGE_ENTRY, '--no-install'])
    await command.exec()

    assert.equal(command.exitCode, 1)
    await assertNothingWritten(fs, assert, rcBefore)
    const logs = ace.ui.logger
      .getLogs()
      .map((log) => log.message)
      .join('\n')
    assert.include(logs, '2 more things')
    assert.include(logs, `import { defineConfig } from '@adonisjs/inertia'`)
    assert.include(logs, "() => import('@adonisjs/inertia/inertia_provider')")
    assert.notInclude(logs, 'node ace add edge')
  })

  test('the API kit: a session guard beside the default one is enough, with a note to use it', async ({
    assert,
    fs,
  }) => {
    const ace = await createApp(fs, VITE, {}, [], TOKENS_AUTH)

    const command = await ace.create(Configure, [PACKAGE_ENTRY, '--no-install'])
    await command.exec()

    command.assertSucceeded()
    await assert.fileExists('config/azu.ts')
    const logs = ace.ui.logger
      .getLogs()
      .map((log) => log.message)
      .join('\n')
    assert.include(logs, "Set guard: 'web' in config/azu.ts")
  })
})
