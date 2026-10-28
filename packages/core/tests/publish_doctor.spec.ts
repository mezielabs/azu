import { readdir, readFile } from 'node:fs/promises'
import { test } from '@japa/runner'
import { IgnitorFactory } from '@adonisjs/core/factories'
import type { LucidModel } from '@adonisjs/lucid/types/model'
import type { FileSystem } from '@japa/file-system'
import vine from '@vinejs/vine'
import AzuPublish from '../commands/azu_publish.ts'
import { defineConfig } from '../src/define_config.ts'
import {
  checkComponents,
  checkConfig,
  checkPolicies,
  checkPublished,
  checkValidators,
  type ConfigFacts,
} from '../src/doctor/checks.ts'
import {
  PAGE_NAMES,
  pageName,
  publishedSource,
  readStamp,
  sourceHash,
  type PageName,
} from '../src/publish/pages.ts'
import { action } from '../src/resources/actions.ts'
import { column } from '../src/resources/columns.ts'
import { defineResource } from '../src/resources/define_resource.ts'
import { field } from '../src/resources/fields.ts'
import { componentName } from '../shared.ts'

const model = (name: string) => ({ name, $getRelation: () => undefined }) as unknown as LucidModel

const INDEX_SOURCE = `import { AdminLayout } from '@mezielabs/azu-react'\n\nexport default function ResourceIndex() {}\n`

async function createAce(fs: FileSystem, options: { withPackage?: boolean } = {}) {
  await fs.createJson('tsconfig.json', {})
  await fs.createJson('package.json', { name: 'app', type: 'module' })
  await fs.create('adonisrc.ts', `export default defineConfig({})`)
  if (options.withPackage !== false) {
    // The installed @mezielabs/azu-react, which ships its pages' source
    await fs.createJson('node_modules/@mezielabs/azu-react/package.json', {
      name: '@mezielabs/azu-react',
      version: '1.4.0',
      exports: { './package.json': './package.json' },
    })
    await fs.create('node_modules/@mezielabs/azu-react/src/pages/resource/index.tsx', INDEX_SOURCE)
  }

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

test.group('Published pages (FR-15)', () => {
  test('page names: snake_case paths, the older PascalCase, or the server name', ({ assert }) => {
    assert.equal(pageName('resource/index'), 'resource/index')
    assert.equal(pageName('Resource/Index'), 'resource/index')
    assert.equal(pageName('azu/errors/not_found'), 'errors/not_found')
    assert.equal(pageName('Errors/NotFound'), 'errors/not_found')
    assert.equal(pageName('dashboard.tsx'), 'dashboard')
    assert.isNull(pageName('resource/archive'))
    assert.isNull(pageName('../app'))
  })

  test('a published page carries its page, version and the original hash', ({ assert }) => {
    const published = publishedSource('resource/index', '1.4.0', INDEX_SOURCE)

    assert.isTrue(published.endsWith(INDEX_SOURCE))
    assert.deepEqual(readStamp(published), {
      page: 'resource/index',
      version: '1.4.0',
      hash: sourceHash(INDEX_SOURCE),
    })
    assert.isNull(readStamp(INDEX_SOURCE))
  })

  test('component names come from file names', ({ assert }) => {
    assert.equal(componentName('./components/sku_input.tsx'), 'SkuInput')
    assert.equal(componentName('forms/stock-bar.jsx'), 'StockBar')
  })
})

test.group('azu:publish (FR-15)', (group) => {
  group.each.timeout(30_000)

  test('no package page imports by relative path, so a published copy compiles', async ({
    assert,
  }) => {
    const pages = new URL('../../react/src/pages/', import.meta.url)
    const entries = await readdir(pages, { recursive: true })
    // Every file but the registry, which lazy-loads the pages by path and is never published
    const files = entries.filter((file) => /\.tsx?$/.test(file) && file !== 'index.ts')
    assert.includeMembers(
      files,
      PAGE_NAMES.map((name) => `${name}.tsx`)
    )
    // `from '../x'`, `import './x'`, `import('./x')`, `export … from './x'`
    const relative = /(?:\bfrom|\bimport)\s*\(?\s*['"]\.{1,2}\//
    for (const file of files) {
      const source = await readFile(new URL(file, pages), 'utf8')
      const line = source.split('\n').find((text) => relative.test(text))
      assert.isUndefined(
        line,
        `${file} imports by relative path; import it from @mezielabs/azu-react: ${line}`
      )
    }
  })

  test('copies a page into inertia/admin/pages with a version stamp', async ({ assert, fs }) => {
    const ace = await createAce(fs)
    const command = await ace.create(AzuPublish, ['Resource/Index'])
    await command.exec()
    command.assertSucceeded()

    const copy = await fs.contents('inertia/admin/pages/resource/index.tsx')
    assert.equal(copy, publishedSource('resource/index', '1.4.0', INDEX_SOURCE))
    command.assertLog(
      '[ green(success) ] Published resource/index to inertia/admin/pages/resource/index.tsx'
    )
  })

  test("won't overwrite a published page without --force", async ({ assert, fs }) => {
    const ace = await createAce(fs)
    await fs.create('inertia/admin/pages/resource/index.tsx', 'my edits')

    const refused = await ace.create(AzuPublish, ['resource/index'])
    await refused.exec()
    refused.assertFailed()
    assert.equal(await fs.contents('inertia/admin/pages/resource/index.tsx'), 'my edits')

    const forced = await ace.create(AzuPublish, ['resource/index', '--force'])
    await forced.exec()
    forced.assertSucceeded()
    assert.isNotNull(readStamp(await fs.contents('inertia/admin/pages/resource/index.tsx')))
  })

  test('lists the pages without an argument, marking published ones', async ({ fs }) => {
    const ace = await createAce(fs)
    await fs.create('inertia/admin/pages/dashboard.tsx', '')
    const command = await ace.create(AzuPublish, [])
    await command.exec()

    command.assertSucceeded()
    command.assertLog('  dashboard (published)')
    command.assertLog('  resource/index')
  })

  test('explains an unknown page, or a missing package', async ({ fs }) => {
    const ace = await createAce(fs, { withPackage: false })

    const unknown = await ace.create(AzuPublish, ['resource/archive'])
    await unknown.exec()
    unknown.assertFailed()
    unknown.assertLogMatches(/Azu has no page named "resource\/archive"/)

    const missing = await ace.create(AzuPublish, ['resource/index'])
    await missing.exec()
    missing.assertFailed()
    missing.assertLogMatches(/Can't find @mezielabs\/azu-react's pages/)
  })
})

class ProductPolicy {
  viewList() {}
  view() {}
  create() {}
  update() {}
  publish() {}
}

test.group('azu:doctor checks (FR-15)', () => {
  test('policies: a missing action ability is an error; other gaps are warnings', ({ assert }) => {
    class ThinPolicy {
      update() {}
    }
    const products = defineResource(model('Product'), {
      policy: ProductPolicy,
      fields: [field.text('name')],
      actions: [
        action
          .bulk('publish')
          .ability('publish')
          .handle(async () => {}),
      ],
    } as never)
    const orders = defineResource(model('Order'), {
      policy: ThinPolicy,
      fields: [field.text('note').ability('annotate' as never)],
      actions: [
        action
          .row('refund')
          .ability('refund' as never)
          .handle(async () => {}),
      ],
    } as never)

    assert.deepEqual(checkPolicies([products]), [])
    assert.deepEqual(
      checkPolicies([orders]).map((finding) => [finding.level, finding.message]),
      [
        ['warning', 'orders: ThinPolicy has no viewList, so no one sees the resource'],
        ['warning', 'orders: ThinPolicy has no view, so no record opens'],
        ['warning', 'orders: ThinPolicy has no create, so the create form never shows'],
        [
          'error',
          'orders: the row action "refund" checks refund, which ThinPolicy doesn\'t have, so it never runs',
        ],
        [
          'warning',
          'orders: the "note" field checks annotate, which ThinPolicy doesn\'t have, so it never shows',
        ],
      ]
    )
  })

  test('validators: a form field the validator does not declare is an error', ({ assert }) => {
    const create = vine.compile(vine.object({ name: vine.string(), sku: vine.string() }))
    const update = vine.compile(vine.object({ name: vine.string() }))
    const products = defineResource(model('Product'), {
      policy: ProductPolicy,
      validators: { create, update },
      fields: [
        field.text('name'),
        field.text('sku'),
        // Only on edit, and read-only fields aren't written: neither needs a rule
        field.text('slug').visibleOn('edit').readOnly(),
        field.text('price').visibleOn('create'),
      ],
    } as never)

    assert.deepEqual(
      checkValidators([products]).map((finding) => finding.message),
      [
        'products: the create validator has no "price" for the "price" field, so what users enter there isn\'t saved',
        'products: the update validator has no "sku" for the "sku" field, so what users enter there isn\'t saved',
      ]
    )

    const fallback = defineResource(model('Tag'), {
      policy: ProductPolicy,
      validators: { create: vine.compile(vine.object({ name: vine.string() })) },
      fields: [field.text('name'), field.text('slug')],
    } as never)
    // Update falls back to the create validator, and says so
    assert.deepEqual(
      checkValidators([fallback]).map((finding) => finding.message),
      [
        'tags: the create validator has no "slug" for the "slug" field, so what users enter there isn\'t saved',
        'tags: the create validator has no "slug" for the "slug" field, so what users enter there isn\'t saved',
      ]
    )

    const none = defineResource(model('Coupon'), {
      policy: ProductPolicy,
      fields: [field.text('code')],
    } as never)
    assert.lengthOf(checkValidators([none]), 2)
  })

  test('components: names no file registers, and two files with one name', ({ assert }) => {
    const products = defineResource(model('Product'), {
      policy: ProductPolicy,
      columns: [column.custom('stock', 'StockBar')],
      fields: [field.text('sku').component('SkuInput')],
      slots: { beforeTable: 'LowStockNotice' },
    } as never)
    const registered = new Map([
      ['SkuInput', ['inertia/admin/components/sku_input.tsx']],
      [
        'StockBar',
        ['inertia/admin/components/stock_bar.tsx', 'inertia/admin/components/list/stock_bar.tsx'],
      ],
    ])

    assert.deepEqual(
      checkComponents([products], registered).map((finding) => [finding.level, finding.message]),
      [
        [
          'warning',
          'inertia/admin/components/stock_bar.tsx and inertia/admin/components/list/stock_bar.tsx both register StockBar; only one is used',
        ],
        [
          'error',
          'products: the beforeTable slot uses LowStockNotice, but no file in inertia/admin/components registers it',
        ],
      ]
    )
  })

  test('published pages: drift, no stamp, and files Azu never renders', ({ assert }) => {
    const sources = new Map<PageName, string | null>([
      ['resource/index', INDEX_SOURCE],
      ['dashboard', 'export default function Dashboard() {}\n'],
    ])
    const files = [
      // Up to date, and edited: edits don't count as drift
      {
        page: 'resource/index',
        content: publishedSource('resource/index', '1.3.0', INDEX_SOURCE) + '// mine',
      },
      // Published from an older original
      { page: 'dashboard', content: publishedSource('dashboard', '1.3.0', 'old dashboard') },
      { page: 'resource/show', content: 'hand-written' },
      { page: 'resource/archive', content: '' },
    ]

    assert.deepEqual(
      checkPublished(files, { version: '1.4.0', sources }).map((finding) => [
        finding.level,
        finding.message,
      ]),
      [
        [
          'warning',
          "inertia/admin/pages/dashboard.tsx drifted: Azu's original changed since it was published from @mezielabs/azu-react 1.3.0 (installed: 1.4.0). Compare it with node_modules/@mezielabs/azu-react/src/pages/dashboard.tsx, then merge the changes or run node ace azu:publish dashboard --force",
        ],
        [
          'note',
          "inertia/admin/pages/resource/show.tsx has no azu:publish stamp, so it can't be checked for drift",
        ],
        [
          'warning',
          'inertia/admin/pages/resource/archive.tsx: Azu has no page named resource/archive, so this file is never rendered',
        ],
      ]
    )
  })

  test('config: guards, disks, the entry, the Vite plugin and resources', ({ assert }) => {
    const facts: ConfigFacts = {
      config: defineConfig({ guard: 'admin', defaultDisk: 's3' }),
      guards: ['web'],
      disks: ['fs'],
      uploadDisks: [undefined, 'fs'],
      entryExists: false,
      viteConfig: `import { defineConfig } from 'vite'`,
      autoloadExists: false,
      resourceCount: 0,
    }

    assert.deepEqual(
      checkConfig(facts).map((finding) => [finding.level, finding.message]),
      [
        ['error', '"guard" is "admin", but config/auth.ts has only web'],
        ['error', 'uploads use the "s3" disk, which config/drive.ts doesn\'t define'],
        ['error', '"entry" is inertia/admin/app.tsx, which doesn\'t exist'],
        ['error', "vite.config.ts doesn't use the azu() plugin from @mezielabs/azu/vite"],
        ['warning', '"resources.autoload" is app/admin/resources, which doesn\'t exist'],
        ['warning', 'no resources are registered, so the admin panel is empty'],
      ]
    )

    assert.deepEqual(
      checkConfig({
        ...facts,
        config: defineConfig({}),
        guards: ['web'],
        entryExists: true,
        viteConfig: `import azu from '@mezielabs/azu/vite'`,
        autoloadExists: true,
        resourceCount: 3,
      }),
      []
    )
  })
})
