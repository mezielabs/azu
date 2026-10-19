import { test } from '@japa/runner'
import type { HttpContext } from '@adonisjs/core/http'
import type { LucidModel } from '@adonisjs/lucid/types/model'
import { action } from '../src/resources/actions.ts'
import { column } from '../src/resources/columns.ts'
import { defineResource, Resource } from '../src/resources/define_resource.ts'
import { field } from '../src/resources/fields.ts'
import { filter } from '../src/resources/filters.ts'
import { humanize } from '../src/resources/labels.ts'
import { loadResources } from '../src/resources/loader.ts'
import { buildNavigation, canList } from '../src/resources/navigation.ts'
import { ResourceRegistry } from '../src/resources/registry.ts'

/**
 * Runtime only needs the model's name, so these stand in for Lucid
 * models. Typing against real models is tested in apps/demo.
 */
const model = (name: string) => ({ name }) as unknown as LucidModel
class CatalogPolicy {
  viewList() {}
}
class SalesPolicy {
  viewList() {}
}

const resource = (name: string, options: Record<string, unknown> = {}) =>
  defineResource(model(name), { policy: CatalogPolicy, ...options } as never)

test.group('Builders', () => {
  test('columns serialise with default labels', ({ assert }) => {
    assert.deepEqual(column.decimal('unitPrice').format('currency', 'NGN').sortable().toJSON(), {
      kind: 'decimal',
      name: 'unitPrice',
      label: 'Unit price',
      sortable: true,
      hiddenByDefault: false,
      component: null,
      format: { style: 'currency', currency: 'NGN' },
      colors: null,
      relationTitle: null,
      labels: null,
    })
    assert.include(column.belongsTo('category', 'name').toJSON(), {
      kind: 'belongsTo',
      label: 'Category',
      relationTitle: 'name',
    })
    assert.include(column.custom('stock', 'StockBar').label('In stock').toJSON(), {
      kind: 'custom',
      label: 'In stock',
      component: 'StockBar',
    })
  })

  test('fields serialise their hints', ({ assert }) => {
    assert.include(field.decimal('price').min('0.00').step('0.01').help('In naira').toJSON(), {
      kind: 'decimal',
      label: 'Price',
      min: '0.00',
      step: '0.01',
      help: 'In naira',
      readOnly: false,
    })
    assert.include(field.belongsTo('category').searchable('name').visibleOn('create').toJSON(), {
      searchable: 'name',
      visibleOn: 'create',
    })
    assert.deepEqual(field.select('status').options({ draft: 'Draft' }).toJSON().options, {
      draft: 'Draft',
    })
    assert.include(field.text('sku').ability('update').readOnly().toJSON(), {
      ability: 'update',
      readOnly: true,
    })
  })

  test('filters and actions serialise', ({ assert }) => {
    assert.deepEqual(filter.custom('Low stock', () => {}).toJSON(), {
      kind: 'custom',
      name: 'low-stock',
      label: 'Low stock',
      options: null,
    })
    assert.deepEqual(filter.select('status', { draft: 'Draft' }).toJSON().options, {
      draft: 'Draft',
    })
    assert.deepEqual(
      action
        .bulk('publish')
        .confirm('Sure?')
        .ability('publish')
        .handle(async () => {})
        .toJSON(),
      {
        kind: 'bulk',
        name: 'publish',
        label: 'Publish',
        confirm: 'Sure?',
        ability: 'publish',
        destructive: false,
        fields: [],
      }
    )
  })

  test('an action without an ability checks update', ({ assert }) => {
    assert.equal(action.row('archive').toJSON().ability, 'update')
  })
})

test.group('defineResource', () => {
  test('derives the URL name and labels from the model', ({ assert }) => {
    const items = resource('OrderItem')

    assert.instanceOf(items, Resource)
    assert.equal(items.name, 'order-items')
    assert.equal(items.label, 'Order items')
    assert.equal(items.singularLabel, 'Order item')
    assert.equal(resource('Category', { label: 'Sections' }).label, 'Sections')
  })

  test('produces a plain-JSON schema without handlers or the policy', ({ assert }) => {
    const products = resource('Product', {
      group: 'Catalog',
      title: 'name',
      search: ['name', 'sku'],
      columns: [column.text('name').sortable()],
      fields: [field.text('name')],
      filters: [filter.custom('Low stock', () => {})],
      actions: [action.bulk('publish').handle(async () => {})],
    })
    const schema = products.toSchema()

    assert.deepEqual(JSON.parse(JSON.stringify(schema)), schema)
    assert.include(schema, { name: 'products', label: 'Products', group: 'Catalog', title: 'name' })
    assert.deepEqual(schema.search, ['name', 'sku'])
    assert.lengthOf(schema.columns, 1)
    assert.notProperty(schema, 'policy')
  })
})

test.group('ResourceRegistry', () => {
  test('registers resources and ignores the same one twice', ({ assert }) => {
    const products = resource('Product')
    const registry = new ResourceRegistry().register(products, products)

    assert.deepEqual(registry.all(), [products])
    assert.strictEqual(registry.get('products'), products)
    assert.isUndefined(registry.get('orders'))
  })

  test('rejects two resources with the same URL name', ({ assert }) => {
    const registry = new ResourceRegistry().register(resource('Product'))

    assert.throws(
      () => registry.register(resource('Product')),
      /Two admin resources are named "products"/
    )
  })

  test('rejects an action named delete, which is the built-in Delete', ({ assert }) => {
    const products = resource('Product', { actions: [action.row('delete').handle(() => {})] })
    assert.throws(
      () => new ResourceRegistry().register(products),
      /declares an action named "delete"/
    )
  })

  test("rejects filters that clash with the list's parameters or each other", ({ assert }) => {
    const reserved = resource('Product', { filters: [filter.custom('Search', (q) => q)] })
    assert.throws(
      () => new ResourceRegistry().register(reserved),
      /filter named "search", which the list uses/
    )
    const twice = resource('Product', {
      filters: [filter.select('status', {}), filter.boolean('status')],
    })
    assert.throws(() => new ResourceRegistry().register(twice), /two filters named "status"/)
  })

  test('rejects anything not made by defineResource', ({ assert }) => {
    assert.throws(() => new ResourceRegistry().register({} as never), /defineResource/)
  })
})

test.group('loadResources', () => {
  const definer = new URL('../src/resources/define_resource.ts', import.meta.url).href

  test('imports the default export of every resource file', async ({ assert, fs }) => {
    await fs.create(
      'resources/product_resource.ts',
      `import { defineResource } from '${definer}'\nexport default defineResource({ name: 'Product' } as any, { policy: class {} })\n`
    )
    await fs.create(
      'resources/sales/order_resource.ts',
      `import { defineResource } from '${definer}'\nexport default defineResource({ name: 'Order' } as any, { policy: class {} })\n`
    )
    await fs.create('resources/product_resource.d.ts', `export {}\n`)

    const resources = await loadResources(fs.basePath + '/resources')

    assert.sameMembers(
      resources.map((item) => item.name),
      ['products', 'orders']
    )
  })

  test('explains a file that does not export a resource', async ({ assert, fs }) => {
    await fs.create('resources/broken.ts', `export default { name: 'nope' }\n`)

    await assert.rejects(() => loadResources(fs.basePath + '/resources'), /must export a resource/)
  })

  test('treats a missing directory as no resources', async ({ assert, fs }) => {
    assert.deepEqual(await loadResources(fs.basePath + '/does-not-exist'), [])
  })
})

/**
 * A request whose Bouncer allows `viewList` per policy, or throws.
 */
function requestWith(allowed: Map<unknown, boolean | 'throws'> | undefined) {
  const warnings: string[] = []
  const ctx = {
    logger: { warn: (...args: unknown[]) => warnings.push(String(args.at(-1))) },
    bouncer: allowed && {
      with: (policy: unknown) => ({
        allows: async (method: string) => {
          const answer = allowed.get(policy)
          if (answer === 'throws') throw new Error(`viewList failed`)
          return method === 'viewList' && answer === true
        },
      }),
    },
  }
  return { ctx: ctx as unknown as HttpContext, warnings }
}

test.group('Navigation', () => {
  const products = resource('Product', { group: 'Catalog', icon: 'package' })
  const categories = resource('Category', { group: 'Catalog' })
  const orders = defineResource(model('Order'), { policy: SalesPolicy, group: 'Sales' } as never)
  const settings = defineResource(model('Setting'), { policy: SalesPolicy } as never)

  test('groups the resources the user may list, sorted by label', async ({ assert }) => {
    const { ctx } = requestWith(
      new Map<unknown, boolean>([
        [CatalogPolicy, true],
        [SalesPolicy, true],
      ])
    )
    const navigation = await buildNavigation(
      ctx,
      [orders, products, settings, categories],
      '/admin'
    )

    assert.deepEqual(navigation, [
      {
        label: null,
        items: [
          { name: 'settings', label: 'Settings', icon: null, href: '/admin/resources/settings' },
        ],
      },
      {
        label: 'Catalog',
        items: [
          {
            name: 'categories',
            label: 'Categories',
            icon: null,
            href: '/admin/resources/categories',
          },
          {
            name: 'products',
            label: 'Products',
            icon: 'package',
            href: '/admin/resources/products',
          },
        ],
      },
      {
        label: 'Sales',
        items: [{ name: 'orders', label: 'Orders', icon: null, href: '/admin/resources/orders' }],
      },
    ])
  })

  test('orders groups by config and resources by order, then by label (FR-16)', async ({
    assert,
  }) => {
    const { ctx } = requestWith(
      new Map<unknown, boolean>([
        [CatalogPolicy, true],
        [SalesPolicy, true],
      ])
    )
    const tags = resource('Tag', { group: 'Catalog' })
    const brands = resource('Brand', { group: 'Catalog' })
    const ordered = [
      resource('Product', { group: 'Catalog', order: 1 }),
      resource('Category', { group: 'Catalog', order: 2 }),
      tags,
      brands,
      defineResource(model('Order'), { policy: SalesPolicy, group: 'Sales' } as never),
      defineResource(model('Report'), { policy: SalesPolicy, group: 'Reports' } as never),
      defineResource(model('Media'), { policy: SalesPolicy, group: 'Assets' } as never),
      settings,
    ]
    const navigation = await buildNavigation(ctx, ordered, '/admin', {
      groups: ['Sales', 'Catalog'],
    })

    assert.deepEqual(
      navigation.map((group) => [group.label, group.items.map((item) => item.name)]),
      [
        // Ungrouped first, then the configured groups, then the rest by label
        [null, ['settings']],
        ['Sales', ['orders']],
        // Ordered resources first, then the rest by label
        ['Catalog', ['products', 'categories', 'brands', 'tags']],
        ['Assets', ['media']],
        ['Reports', ['reports']],
      ]
    )
  })

  test('hides resources whose viewList denies the user', async ({ assert }) => {
    const { ctx } = requestWith(
      new Map<unknown, boolean>([
        [CatalogPolicy, true],
        [SalesPolicy, false],
      ])
    )
    const navigation = await buildNavigation(ctx, [orders, products], '/admin')

    assert.deepEqual(
      navigation.flatMap((group) => group.items.map((item) => item.name)),
      ['products']
    )
  })

  test('hides a resource whose policy has no viewList method', async ({ assert }) => {
    class EmptyPolicy {}
    const { ctx, warnings } = requestWith(new Map([[EmptyPolicy, true]]))
    const empty = defineResource(model('Empty'), { policy: EmptyPolicy } as never)

    assert.isFalse(await canList(ctx, empty))
    assert.lengthOf(warnings, 0)
  })

  test('hides a resource whose viewList throws, and logs why', async ({ assert }) => {
    const { ctx, warnings } = requestWith(new Map([[CatalogPolicy, 'throws']]))

    assert.isFalse(await canList(ctx, products))
    assert.match(warnings[0], /viewList/)
  })

  test('hides everything without Bouncer', async ({ assert }) => {
    const { ctx } = requestWith(undefined)

    assert.deepEqual(await buildNavigation(ctx, [products, orders], '/admin'), [])
  })
})

test.group('Labels', () => {
  test('known acronyms are capitals, plurals included; other words are left alone', ({
    assert,
  }) => {
    const cases: Record<string, string> = {
      sku: 'SKU',
      skuCode: 'SKU code',
      id: 'ID',
      userId: 'User ID',
      ids: 'IDs',
      imageUrl: 'Image URL',
      imageUrls: 'Image URLs',
      apiKey: 'API key',
      vatRate: 'VAT rate',
      uuid: 'UUID',
      ApiKeys: 'API keys',
      // Words that merely start or end like one
      idea: 'Idea',
      identity: 'Identity',
      status: 'Status',
      guid: 'Guid',
    }
    for (const [name, label] of Object.entries(cases)) {
      assert.equal(humanize(name), label, name)
    }
  })

  test('fields, columns, filters and actions use them; an explicit label() wins', ({ assert }) => {
    assert.equal(field.text('sku').toJSON().label, 'SKU')
    assert.equal(column.text('imageUrl').toJSON().label, 'Image URL')
    assert.equal(filter.boolean('hasVat').toJSON().label, 'Has VAT')
    assert.equal(
      action
        .row('regenerateUuid')
        .handle(async () => {})
        .toJSON().label,
      'Regenerate UUID'
    )
    assert.equal(field.text('sku').label('Sku').toJSON().label, 'Sku')
    assert.equal(column.text('sku').label('Stock code').toJSON().label, 'Stock code')
  })
})

test.group('Slots (FR-15)', () => {
  test('a slot names a component, or adds server data for the pages it renders on', async ({
    assert,
  }) => {
    const calls: { page: string; record: unknown }[] = []
    const products = resource('Product', {
      slots: {
        header: 'ProductHeader',
        beforeTable: {
          component: 'LowStockNotice',
          data: async ({ page, record }: { page: string; record: unknown }) => {
            calls.push({ page, record })
            return { count: 6 }
          },
        },
        toolbar: { component: 'Exports', data: () => ['csv'] },
      },
    })

    // The schema carries component names only
    assert.deepEqual(products.toSchema().slots, {
      header: 'ProductHeader',
      toolbar: 'Exports',
      beforeTable: 'LowStockNotice',
      afterForm: null,
    })

    const ctx = {} as HttpContext
    assert.deepEqual(await products.slotData(ctx, 'index'), {
      toolbar: ['csv'],
      beforeTable: { count: 6 },
    })
    // beforeTable isn't on the detail page, so its data doesn't run there
    const record = { id: 3 }
    assert.deepEqual(await products.slotData(ctx, 'show', record as never), { toolbar: ['csv'] })
    assert.deepEqual(calls, [{ page: 'index', record: null }])

    // No data functions: nothing to send
    assert.deepEqual(await resource('Tag').slotData(ctx, 'index'), {})
  })
})
