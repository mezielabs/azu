import { test } from '@japa/runner'
import { IgnitorFactory } from '@adonisjs/core/factories'
import type { FileSystem } from '@japa/file-system'
import AzuScreen from '../commands/azu_screen.ts'

async function createAce(fs: FileSystem) {
  await fs.createJson('tsconfig.json', {})
  await fs.createJson('package.json', { name: 'app', type: 'module' })
  await fs.create('adonisrc.ts', `export default defineConfig({})`)

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

test.group('azu:screen (FR-20)', (group) => {
  group.each.timeout(30_000)

  test('writes a screen and its component, named from the argument', async ({ assert, fs }) => {
    const ace = await createAce(fs)
    const command = await ace.create(AzuScreen, ['SalesReport'])
    await command.exec()
    command.assertSucceeded()

    const screen = await fs.contents('app/admin/screens/sales_report.ts')
    assert.include(screen, `import { defineScreen } from '@mezielabs/azu'`)
    assert.include(screen, `import { accessAdmin } from '#abilities/main'`)
    assert.include(screen, `label: 'Sales report',`)
    assert.include(screen, `ability: accessAdmin,`)
    assert.include(screen, `component: 'SalesReport',`)
    assert.include(screen, `at /admin/screens/sales-report`)

    const component = await fs.contents('inertia/admin/components/sales_report.tsx')
    assert.include(component, `import type { ScreenProps } from '@mezielabs/azu-react'`)
    assert.include(component, `import type screen from '#admin/screens/sales_report'`)
    assert.include(
      component,
      `export default function SalesReport({ data }: ScreenProps<typeof screen>) {`
    )
    command.assertLogMatches(/\/admin\/screens\/sales-report/)
  })

  test('--form writes a form screen and its validator, without a component (FR-23)', async ({
    assert,
    fs,
  }) => {
    const ace = await createAce(fs)
    const command = await ace.create(AzuScreen, ['SiteSettings', '--form'])
    await command.exec()
    command.assertSucceeded()

    const screen = await fs.contents('app/admin/screens/site_settings.ts')
    assert.include(screen, `import { defineScreen, field } from '@mezielabs/azu'`)
    assert.include(screen, `import { siteSettingsValidator } from '#validators/site_settings'`)
    assert.include(screen, `label: 'Site settings',`)
    assert.include(screen, `fields: [field.text('title'), field.boolean('enabled')],`)
    assert.include(screen, `validator: siteSettingsValidator,`)
    assert.include(screen, `load: () => values,`)
    assert.notInclude(screen, 'component:')

    const validator = await fs.contents('app/validators/site_settings.ts')
    assert.include(validator, `export const siteSettingsValidator = vine.create({`)
    assert.include(validator, `title: vine.string()`)
    assert.include(validator, `enabled: vine.boolean(),`)

    assert.isFalse(await fs.exists('inertia/admin/components/site_settings.tsx'))
    command.assertLogMatches(/\/admin\/screens\/site-settings/)
  })

  test("keeps existing files unless --force, and refuses a name that isn't one", async ({
    assert,
    fs,
  }) => {
    const ace = await createAce(fs)
    await fs.create('app/admin/screens/overview.ts', '// mine')
    const kept = await ace.create(AzuScreen, ['Overview'])
    await kept.exec()
    assert.equal(await fs.contents('app/admin/screens/overview.ts'), '// mine')

    const forced = await ace.create(AzuScreen, ['Overview', '--force'])
    await forced.exec()
    assert.include(await fs.contents('app/admin/screens/overview.ts'), `component: 'Overview'`)

    const bad = await ace.create(AzuScreen, ['123'])
    await bad.exec()
    assert.equal(bad.exitCode, 1)
  })
})
