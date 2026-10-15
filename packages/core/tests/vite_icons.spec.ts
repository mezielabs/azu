import { test } from '@japa/runner'
import { build } from 'vite'
import type { FileSystem } from '@japa/file-system'
import { usedIconNames, iconsModule } from '../src/vite/icons.ts'
import { azu } from '../src/vite/plugin.ts'

const SPECIFIER = '@mezielabs/azu-react/icons'

/**
 * A front-end package whose empty icons module the plugin replaces, an
 * entry that renders the icons it gets, and resources naming icons.
 */
async function createApp(fs: FileSystem, options: { iconPackage: boolean }) {
  await fs.createJson('package.json', { name: 'app', type: 'module' })
  await fs.create(
    'main.js',
    `import icons from '${SPECIFIER}'\nconsole.log(Object.entries(icons).map(([name, icon]) => name + ':' + icon()))\n`
  )
  await fs.createJson('node_modules/@mezielabs/azu-react/package.json', {
    name: '@mezielabs/azu-react',
    type: 'module',
    exports: { './icons': './icons.js' },
    azu: {
      icons: { specifier: SPECIFIER, package: 'fixture-icons', path: 'icons/{name}.js' },
    },
  })
  await fs.create('node_modules/@mezielabs/azu-react/icons.js', 'export default {}\n')
  if (options.iconPackage) {
    await fs.createJson('node_modules/fixture-icons/package.json', {
      name: 'fixture-icons',
      type: 'module',
    })
    for (const name of ['package', 'receipt', 'shopping-cart', 'unused-icon']) {
      await fs.create(
        `node_modules/fixture-icons/icons/${name}.js`,
        `export default () => 'svg ${name}'\n`
      )
    }
  }
  await fs.create('app/admin/resources/product_resource.ts', `export default { icon: 'package' }\n`)
  await fs.create(
    'app/admin/resources/sales/order_resource.ts',
    `export default { group: 'Sales', icon: "receipt", title: 'number' }\n`
  )
  await fs.create(
    'app/admin/resources/coupon_resource.ts',
    `export default { icon: 'no-such-icon' }\n`
  )
}

async function buildApp(fs: FileSystem, options: Parameters<typeof azu>[0] = {}) {
  const warnings: string[] = []
  const output = await build({
    root: fs.basePath,
    configFile: false,
    logLevel: 'silent',
    build: { write: false, minify: false },
    plugins: [azu({ entry: 'main.js', dedupe: [], ...options })],
    customLogger: {
      info() {},
      warn(message: string) {
        warnings.push(message)
      },
      warnOnce(message: string) {
        warnings.push(message)
      },
      error() {},
      clearScreen() {},
      hasErrorLogged: () => false,
      hasWarned: false,
    },
  })
  const results = Array.isArray(output) ? output : [output]
  const code = results
    .flatMap((result) => ('output' in result ? result.output : []))
    .map((chunk) => ('code' in chunk ? chunk.code : ''))
    .join('\n')
  return { code, warnings: warnings.join('\n') }
}

test.group('azu() navigation icons (FR-16)', (group) => {
  group.each.timeout(30_000)

  test('reads the icon names the resources use', async ({ assert, fs }) => {
    await createApp(fs, { iconPackage: false })
    assert.deepEqual(usedIconNames(`${fs.basePath}/app/admin/resources`, ['shopping-cart']), [
      'no-such-icon',
      'package',
      'receipt',
      'shopping-cart',
    ])
    assert.deepEqual(usedIconNames(`${fs.basePath}/nowhere`), [])
  })

  test('bundles only the icons in use, and warns about unknown names', async ({ assert, fs }) => {
    await createApp(fs, { iconPackage: true })
    const { code, warnings } = await buildApp(fs, { icons: ['shopping-cart'] })

    assert.include(code, 'svg package')
    assert.include(code, 'svg receipt')
    assert.include(code, 'svg shopping-cart')
    assert.notInclude(code, 'svg unused-icon')
    assert.include(warnings, 'Unknown icon "no-such-icon"')
  })

  test('without the icon package, the empty module stays', async ({ assert, fs }) => {
    await createApp(fs, { iconPackage: false })
    const { code } = await buildApp(fs)
    assert.notInclude(code, 'svg ')
  })

  test('reads resources from the configured directory', async ({ assert, fs }) => {
    await createApp(fs, { iconPackage: true })
    await fs.create('admin/resources/tag_resource.ts', `export default { icon: 'unused-icon' }\n`)
    const { code } = await buildApp(fs, { resources: 'admin/resources' })
    assert.include(code, 'svg unused-icon')
    assert.notInclude(code, 'svg package')
  })

  test('generates one import per icon', ({ assert }) => {
    assert.equal(
      iconsModule([{ name: 'package', file: '/icons/package.js' }]),
      'import icon0 from "/icons/package.js"\n\nexport default {\n  "package": icon0,\n}\n'
    )
  })
})
