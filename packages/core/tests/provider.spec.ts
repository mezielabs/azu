import { test } from '@japa/runner'
import type { FileSystem } from '@japa/file-system'
import { IgnitorFactory } from '@adonisjs/core/factories'
import type { LucidModel } from '@adonisjs/lucid/types/model'
import { defineConfig } from '../src/define_config.ts'
import type { AzuConfigInput } from '../src/types.ts'

const definer = new URL('../src/resources/define_resource.ts', import.meta.url).href

/**
 * Boots a real app with AzuProvider, runs its start hook, and returns
 * the `azu` service.
 */
async function bootApp(fs: FileSystem, admin: AzuConfigInput) {
  await fs.create(
    'app/admin/resources/product_resource.ts',
    `import { defineResource } from '${definer}'\nexport default defineResource({ name: 'Product' } as any, { policy: class {} })\n`
  )

  const ignitor = new IgnitorFactory()
    .withCoreProviders()
    .withCoreConfig()
    .merge({
      config: { azu: defineConfig(admin) },
      rcFileContents: {
        providers: [() => import('../providers/azu_provider.ts')],
      },
    })
    .create(fs.baseUrl, { importer: (filePath) => import(filePath) })

  const app = ignitor.createApp('web')
  await app.init()
  await app.boot()
  await app.start(() => {})
  return { app, azu: await app.container.make('azu') }
}

test.group('AzuProvider resource discovery (FR-03)', (group) => {
  group.each.timeout(30_000)

  test('autoloads resources from app/admin/resources', async ({ assert, fs }) => {
    const { app, azu } = await bootApp(fs, {})

    assert.deepEqual(
      azu.resources.all().map((resource) => resource.name),
      ['products']
    )
    await app.terminate()
  })

  test('with autoload off, loads nothing and takes explicit registrations', async ({
    assert,
    fs,
  }) => {
    const { app, azu } = await bootApp(fs, { resources: { autoload: false } })
    assert.deepEqual(azu.resources.all(), [])

    // What start/azu.ts does, through the public service
    const { default: service } = await import('../services/main.ts')
    const { defineResource } = await import('../src/resources/define_resource.ts')
    service.register(
      defineResource({ name: 'Order' } as unknown as LucidModel, { policy: class {} } as never)
    )

    assert.strictEqual(service, azu)
    assert.deepEqual(
      azu.resources.all().map((resource) => resource.name),
      ['orders']
    )
    await app.terminate()
  })
})
