import { test } from '@japa/runner'
import type { FileSystem } from '@japa/file-system'
import { IgnitorFactory } from '@adonisjs/core/factories'
import type { LucidModel } from '@adonisjs/lucid/types/model'
import { defineConfig } from '../src/define_config.ts'
import type { AzuConfigInput } from '../src/types.ts'

const definer = new URL('../src/resources/define_resource.ts', import.meta.url).href
const screenDefiner = new URL('../src/screens/define_screen.ts', import.meta.url).href

/** A screen file, with a stand-in ability */
const screenFile = (label: string) =>
  `import { defineScreen } from '${screenDefiner}'\nexport default defineScreen({ label: '${label}', ability: { execute() {} } as any, component: 'Report' })\n`

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

test.group('AzuProvider screens and home (FR-20, FR-22)', (group) => {
  group.each.timeout(30_000)

  test('autoloads screens from app/admin/screens, named after their files', async ({
    assert,
    fs,
  }) => {
    await fs.create('app/admin/screens/sales_report.ts', screenFile('Sales report'))
    const { app, azu } = await bootApp(fs, { home: 'sales-report' })
    assert.deepEqual(
      azu.screens.all().map((entry) => entry.name),
      ['sales-report']
    )
    await app.terminate()
  })

  test('two screens with one name are a boot error', async ({ assert, fs }) => {
    await fs.create('app/admin/screens/sales_report.ts', screenFile('Sales report'))
    await fs.create('app/admin/screens/sales-report.ts', screenFile('Sales'))
    await assert.rejects(() => bootApp(fs, {}), /Two admin screens are named "sales-report"/)
  })

  test('a home naming no screen or resource is a boot error', async ({ assert, fs }) => {
    await assert.rejects(
      () => bootApp(fs, { home: 'nowhere' }),
      /"home" in config\/azu.ts is "nowhere", but no screen has that name/
    )
    await assert.rejects(
      () => bootApp(fs, { home: { resource: 'invoices' } }),
      /\{ resource: "invoices" \}, but no resource has that name/
    )
  })
})
