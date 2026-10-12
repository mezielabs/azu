import { test } from '@japa/runner'
import { IgnitorFactory } from '@adonisjs/core/factories'
import Configure from '@adonisjs/core/commands/configure'
import type { FileSystem } from '@japa/file-system'

const PACKAGE_ENTRY = new URL('../index.ts', import.meta.url).href

/**
 * A minimal app on disk with a booted container, so the real Configure
 * command runs the hook and its codemods.
 */
async function createApp(fs: FileSystem, viteConfig: string) {
  await fs.create('.env', '')
  await fs.createJson('tsconfig.json', {})
  await fs.createJson('package.json', { name: 'app', type: 'module' })
  await fs.create('adonisrc.ts', `export default defineConfig({})`)
  await fs.create('vite.config.ts', viteConfig)

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
   * Each test boots an app, which is slow under coverage
   */
  group.each.timeout(15_000)

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

    await assert.fileContains('config/admin.ts', `import { defineConfig } from '@mezielabs/azu'`)
    await assert.fileContains('config/admin.ts', `path: '/admin'`)
    await assert.fileContains('inertia/admin/app.tsx', `createAzuApp({`)
    await assert.fileContains('adonisrc.ts', `@mezielabs/azu/azu_provider`)
    await assert.fileContains('vite.config.ts', `import { azu } from '@mezielabs/azu/vite'`)
    await assert.fileContains('vite.config.ts', `azu()`)

    // Generated files end with a newline, as Prettier expects
    const adminConfig = await fs.contents('config/admin.ts')
    const adminEntry = await fs.contents('inertia/admin/app.tsx')
    assert.isTrue(adminConfig.endsWith('adminConfig\n'))
    assert.isTrue(adminEntry.endsWith('})\n'))
  })

  test('keeps an existing config file', async ({ assert, fs }) => {
    await fs.create('config/admin.ts', `// mine`)
    const ace = await createApp(fs, `export default { plugins: [] }`)

    const command = await ace.create(Configure, [PACKAGE_ENTRY, '--no-install'])
    await command.exec()

    assert.equal(await fs.contents('config/admin.ts'), `// mine`)
  })
})
