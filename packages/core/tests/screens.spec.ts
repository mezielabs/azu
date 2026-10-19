import { test } from '@japa/runner'
import type { HttpContext } from '@adonisjs/core/http'
import type { LucidModel } from '@adonisjs/lucid/types/model'
import { Bouncer } from '@adonisjs/bouncer'
import { Azu } from '../src/azu.ts'
import { defineConfig } from '../src/define_config.ts'
import { checkComponents, checkConfig, type ConfigFacts } from '../src/doctor/checks.ts'
import { defineResource } from '../src/resources/define_resource.ts'
import { buildNavigation } from '../src/resources/navigation.ts'
import { abilityAllows } from '../src/screens/abilities.ts'
import { defineScreen, Screen } from '../src/screens/define_screen.ts'
import { assertHome } from '../src/screens/home.ts'
import { loadScreens, screenName } from '../src/screens/loader.ts'
import { ScreenRegistry } from '../src/screens/registry.ts'
import { currentNavigationItem, usedComponentNames } from '../shared.ts'

const everyone = Bouncer.ability(() => true)
const admins = Bouncer.ability(() => true)
const broken = Bouncer.ability(() => true)

/**
 * A request whose Bouncer answers screen and link abilities from
 * `answers`, and resource policies with `policy`
 */
function request(answers: Map<unknown, boolean | 'throws'>, policy = true) {
  const warnings: string[] = []
  const ctx = {
    logger: { warn: (...args: unknown[]) => warnings.push(String(args.at(-1))) },
    bouncer: {
      allows: async (ability: unknown) => {
        const answer = answers.get(ability)
        if (answer === 'throws') throw new Error('the ability failed')
        return answer === true
      },
      with: () => ({ allows: async () => policy }),
    },
  }
  return { ctx: ctx as unknown as HttpContext, warnings }
}

const report = defineScreen({
  label: 'Sales report',
  group: 'Reports',
  icon: 'chart-column',
  ability: admins,
  component: 'SalesReport',
  data: async () => ({ days: 7, total: '12.50' }),
})

test.group('Screens (FR-20)', () => {
  test('defineScreen needs a label, a component and an ability object', ({ assert }) => {
    assert.instanceOf(report, Screen)
    assert.isTrue(Screen.isScreen(report))
    assert.isFalse(Screen.isScreen({ options: {} }))
    assert.throws(() => defineScreen({ label: '', ability: everyone, component: 'X' }), /a label/)
    assert.throws(
      () => defineScreen({ label: 'Report', ability: everyone, component: '' }),
      /component name/
    )
    // A string, or no ability at all, is refused: a screen never opens by accident
    assert.throws(
      () => defineScreen({ label: 'Report', ability: 'viewReports' as never, component: 'X' }),
      /needs an ability: a Bouncer ability object/
    )
    assert.throws(
      () => defineScreen({ label: 'Report', component: 'X' } as never),
      /needs an ability/
    )
    assert.deepEqual(report.toSchema('sales-report'), {
      name: 'sales-report',
      label: 'Sales report',
      group: 'Reports',
      icon: 'chart-column',
      component: 'SalesReport',
    })
  })

  test('names come from files; two screens with one name fail at boot', ({ assert }) => {
    assert.equal(screenName('/app/admin/screens/sales_report.ts'), 'sales-report')
    assert.equal(screenName('overview.js'), 'overview')

    const registry = new ScreenRegistry()
    registry.register('sales-report', report)
    // The same screen again is a no-op
    registry.register('sales-report', report)
    const other = defineScreen({ label: 'Sales', ability: everyone, component: 'Sales' })
    assert.throws(
      () => registry.register('sales-report', other),
      /Two admin screens are named "sales-report" \("Sales report" and "Sales"\)/
    )
    assert.throws(() => registry.register('Sales Report', other), /can't name a screen/)
    assert.throws(() => registry.register('x', { options: {} } as never), /defineScreen/)
    assert.deepEqual(
      registry.all().map((entry) => entry.name),
      ['sales-report']
    )
  })

  test('autoloads default exports from the screens directory, named by file', async ({
    assert,
    fs,
  }) => {
    await fs.create(
      'app/admin/screens/sales_report.ts',
      `import { defineScreen } from '${new URL('../src/screens/define_screen.ts', import.meta.url).href}'
export default defineScreen({ label: 'Sales report', ability: { execute() {} } as never, component: 'SalesReport' })`
    )
    const screens = await loadScreens(`${fs.basePath}/app/admin/screens`)
    assert.deepEqual(
      screens.map((entry) => [entry.name, entry.screen.options.label]),
      [['sales-report', 'Sales report']]
    )
    assert.deepEqual(await loadScreens(`${fs.basePath}/nowhere`), [])

    await fs.create('app/admin/screens/broken.ts', 'export default { label: "Nope" }')
    await assert.rejects(
      () => loadScreens(`${fs.basePath}/app/admin/screens`),
      /must export a screen as its default/
    )
  })

  test('abilities fail closed: false, a throw, or no Bouncer is denied', async ({ assert }) => {
    const { ctx, warnings } = request(
      new Map<unknown, boolean | 'throws'>([
        [everyone, true],
        [admins, false],
        [broken, 'throws'],
      ])
    )
    assert.isTrue(await abilityAllows(ctx, everyone))
    assert.isFalse(await abilityAllows(ctx, admins))
    assert.isFalse(await abilityAllows(ctx, broken))
    assert.lengthOf(warnings, 1)
    assert.isFalse(await abilityAllows({} as HttpContext, everyone))
  })

  test('the screen page preloads its component', ({ assert }) => {
    assert.deepEqual(
      [...usedComponentNames('azu/screen', { screen: { component: 'SalesReport' } })],
      ['SalesReport']
    )
    assert.deepEqual([...usedComponentNames('azu/screen', {})], [])
  })
})

test.group('Navigation with screens and links (FR-20, FR-21)', () => {
  const products = defineResource(
    { name: 'Product' } as unknown as LucidModel,
    {
      policy: class {
        viewList() {}
      },
      group: 'Catalog',
      order: 2,
    } as never
  )
  const lowStock = defineScreen({
    label: 'Low stock',
    group: 'Catalog',
    order: 1,
    ability: everyone,
    component: 'LowStock',
  })
  const overview = defineScreen({ label: 'Overview', ability: everyone, component: 'Overview' })
  const screens = [
    { name: 'sales-report', screen: report },
    { name: 'low-stock', screen: lowStock },
    { name: 'overview', screen: overview },
  ]
  const links = [
    { label: 'Awaiting shipping', url: '/admin/resources/orders?status=paid', group: 'Catalog' },
    { label: 'Docs', url: 'https://example.com/docs', group: 'Help', icon: 'book-open' },
    { label: 'Audit log', url: '/admin/audit', group: 'Help', ability: admins },
    { label: 'Broken', url: '/admin/broken', ability: broken },
  ]

  test('sorts resources, screens and links together, by order then label', async ({ assert }) => {
    const { ctx } = request(
      new Map<unknown, boolean | 'throws'>([
        [everyone, true],
        [admins, true],
        [broken, 'throws'],
      ])
    )
    const navigation = await buildNavigation(ctx, [products], '/admin', {
      groups: ['Catalog'],
      screens,
      links,
    })
    assert.deepEqual(
      navigation.map((group) => [
        group.label,
        group.items.map((item) => `${item.kind}:${item.name}`),
      ]),
      [
        [null, ['screen:overview']],
        ['Catalog', ['screen:low-stock', 'resource:products', 'link:link-0']],
        ['Help', ['link:link-2', 'link:link-1']],
        ['Reports', ['screen:sales-report']],
      ]
    )
    const help = navigation.find((group) => group.label === 'Help')!
    assert.deepEqual(help.items[1], {
      kind: 'link',
      name: 'link-1',
      label: 'Docs',
      icon: 'book-open',
      href: 'https://example.com/docs',
      external: true,
    })
    const reports = navigation.find((group) => group.label === 'Reports')!
    assert.equal(reports.items[0].href, '/admin/screens/sales-report')
  })

  test('hides screens and links the user fails; a throwing ability hides too', async ({
    assert,
  }) => {
    const { ctx } = request(
      new Map<unknown, boolean | 'throws'>([
        [everyone, true],
        [admins, false],
        [broken, 'throws'],
      ])
    )
    const navigation = await buildNavigation(ctx, [products], '/admin', { screens, links })
    const names = navigation.flatMap((group) => group.items.map((item) => item.label))
    assert.notInclude(names, 'Sales report')
    assert.notInclude(names, 'Audit log')
    assert.notInclude(names, 'Broken')
    // Links without an ability show for everyone
    assert.includeMembers(names, ['Awaiting shipping', 'Docs', 'Overview'])
  })

  test('the home screen is the first link, so it is not listed again', async ({ assert }) => {
    const { ctx } = request(new Map<unknown, boolean | 'throws'>([[everyone, true]]))
    const navigation = await buildNavigation(ctx, [], '/admin', { screens, home: 'overview' })
    assert.notInclude(
      navigation.flatMap((group) => group.items.map((item) => item.name)),
      'overview'
    )
  })

  test('a link is current when path and query match; otherwise the resource or screen', ({
    assert,
  }) => {
    const groups = [
      {
        label: 'Sales',
        items: [
          {
            kind: 'resource',
            name: 'orders',
            label: 'Orders',
            icon: null,
            href: '/admin/resources/orders',
            external: false,
          },
          {
            kind: 'link',
            name: 'link-0',
            label: 'Awaiting',
            icon: null,
            href: '/admin/resources/orders?status=paid&sort=placedAt',
            external: false,
          },
          {
            kind: 'screen',
            name: 'sales-report',
            label: 'Sales report',
            icon: null,
            href: '/admin/screens/sales-report',
            external: false,
          },
          {
            kind: 'link',
            name: 'link-1',
            label: 'Docs',
            icon: null,
            href: 'https://example.com/admin/resources/orders',
            external: true,
          },
        ],
      },
    ] as never
    // The query matches in any order
    assert.equal(
      currentNavigationItem('/admin/resources/orders?sort=placedAt&status=paid', groups),
      'link:link-0'
    )
    assert.equal(
      currentNavigationItem('/admin/resources/orders?status=shipped', groups),
      'resource:orders'
    )
    assert.equal(
      currentNavigationItem('/admin/resources/orders/12/edit', groups),
      'resource:orders'
    )
    assert.equal(
      currentNavigationItem('/admin/screens/sales-report?days=30', groups),
      'screen:sales-report'
    )
    assert.isNull(currentNavigationItem('/admin/resources/ordersx', groups))
  })
})

test.group('Home and links config (FR-21, FR-22)', () => {
  test('defineConfig takes home and links, and refuses malformed ones', ({ assert }) => {
    const config = defineConfig({
      home: 'overview',
      navigation: { links: [{ label: 'Docs', url: 'https://example.com', ability: everyone }] },
    })
    assert.equal(config.home, 'overview')
    assert.equal(config.navigation.links[0].label, 'Docs')
    assert.deepEqual(config.screens, { autoload: 'app/admin/screens' })
    assert.isNull(defineConfig().home)
    assert.deepEqual(defineConfig({ home: { resource: 'orders' } }).home, { resource: 'orders' })
    assert.isFalse(defineConfig({ screens: { autoload: false } }).screens.autoload)

    assert.throws(() => defineConfig({ home: '' }), /"home" in config\/azu.ts/)
    assert.throws(() => defineConfig({ home: { screen: 'x' } as never }), /"home"/)
    assert.throws(
      () => defineConfig({ navigation: { links: [{ label: 'Docs' } as never] } }),
      /navigation.links\[0\]" in config\/azu.ts \("Docs"\) needs a url/
    )
    assert.throws(
      () =>
        defineConfig({
          navigation: { links: [{ label: 'Docs', url: '/d', ability: 'admins' as never }] },
        }),
      /must be a Bouncer ability object/
    )
  })

  test('a home naming no screen or resource is a boot error', ({ assert }) => {
    const azu = new Azu().registerScreen('overview', report)
    azu.register(
      defineResource({ name: 'Order' } as unknown as LucidModel, { policy: class {} } as never)
    )
    assert.doesNotThrow(() => assertHome({ home: null }, azu))
    assert.doesNotThrow(() => assertHome({ home: 'overview' }, azu))
    assert.doesNotThrow(() => assertHome({ home: { resource: 'orders' } }, azu))
    assert.throws(
      () => assertHome({ home: 'dashboard' }, azu),
      /"home" in config\/azu.ts is "dashboard", but no screen has that name \(screens: overview\)/
    )
    assert.throws(
      () => assertHome({ home: { resource: 'invoices' } }, azu),
      /\{ resource: "invoices" \}, but no resource has that name/
    )
  })
})

test.group('Doctor checks for screens and links', () => {
  const facts = (overrides: Partial<ConfigFacts> = {}): ConfigFacts => ({
    config: defineConfig(),
    guards: ['web'],
    disks: null,
    uploadDisks: [],
    entryExists: true,
    viteConfig: "import { azu } from '@mezielabs/azu/vite'",
    autoloadExists: true,
    resourceCount: 1,
    screenNames: ['overview'],
    resourceNames: ['orders'],
    ...overrides,
  })

  test('a screen component no file registers is an error', ({ assert }) => {
    const registered = new Map([['Overview', ['inertia/admin/components/overview.tsx']]])
    const screens = [
      {
        name: 'overview',
        screen: defineScreen({ label: 'Overview', ability: everyone, component: 'Overview' }),
      },
      { name: 'sales-report', screen: report },
    ]
    assert.deepEqual(
      checkComponents([], registered, screens).map((finding) => [finding.level, finding.message]),
      [
        [
          'error',
          'the sales-report screen uses SalesReport, but no file in inertia/admin/components registers it',
        ],
      ]
    )
  })

  test('home naming nothing is an error; a link group not in navigation.groups is a note', ({
    assert,
  }) => {
    const messages = (config: Parameters<typeof defineConfig>[0]) =>
      checkConfig(facts({ config: defineConfig(config) })).map((finding) => [
        finding.level,
        finding.message,
      ])
    assert.deepEqual(messages({ home: 'overview' }), [])
    assert.deepEqual(messages({ home: { resource: 'orders' } }), [])
    assert.deepEqual(messages({ home: 'reports' }), [
      ['error', '"home" is "reports", but no screen has that name'],
    ])
    assert.deepEqual(messages({ home: { resource: 'invoices' } }), [
      ['error', '"home" is { resource: "invoices" }, but no resource has that name'],
    ])
    assert.deepEqual(
      messages({
        navigation: {
          groups: ['Sales'],
          links: [
            { label: 'Awaiting shipping', url: '/a', group: 'Sales' },
            { label: 'Docs', url: 'https://example.com', group: 'Help' },
            { label: 'Ungrouped', url: '/b' },
          ],
        },
      }),
      [
        [
          'note',
          'the "Docs" link\'s group, Help, isn\'t in navigation.groups, so it comes after the listed groups',
        ],
      ]
    )
  })
})
