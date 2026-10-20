import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { createUser } from './helpers.ts'

const navResource = (name: string, label: string, icon: string) => ({
  kind: 'resource',
  name,
  label,
  icon,
  href: `/admin/resources/${name}`,
  external: false,
})

// Products before Categories, by `order` (FR-16)
const CATALOG = {
  label: 'Catalog',
  items: [
    navResource('products', 'Products', 'package'),
    navResource('categories', 'Categories', 'folder'),
    navResource('tags', 'Tags', 'tag'),
  ],
}
const COUPONS = navResource('coupons', 'Coupons', 'ticket')
// A link (FR-21), with order 2 like Coupons: then by label
const AWAITING = {
  kind: 'link',
  name: 'link-0',
  label: 'Awaiting shipping',
  icon: 'truck',
  href: '/admin/resources/orders?status=paid',
  external: false,
}
// Orders before the rest, by `order`
const SALES = {
  label: 'Sales',
  items: [navResource('orders', 'Orders', 'receipt'), AWAITING, COUPONS],
}
// A screen (FR-20), admins only
const REPORTS = {
  label: 'Reports',
  items: [
    {
      kind: 'screen',
      name: 'sales-report',
      label: 'Sales report',
      icon: 'chart-column',
      href: '/admin/screens/sales-report',
      external: false,
    },
  ],
}
// A form screen (FR-23), admins only (manageSettings)
const SETTINGS = {
  label: 'Settings',
  items: [
    {
      kind: 'screen',
      name: 'store-settings',
      label: 'Store settings',
      icon: 'settings',
      href: '/admin/screens/store-settings',
      external: false,
    },
  ],
}
// An external link: a new tab
const HELP = {
  label: 'Help',
  items: [
    {
      kind: 'link',
      name: 'link-1',
      label: 'Azu documentation',
      icon: 'book-open',
      href: 'https://github.com/mezielabs/azu#readme',
      external: true,
    },
  ],
}

/**
 * FR-03: resources in app/admin/resources load with no registration
 * step, and appear in navigation for users whose policy allows viewList.
 */
test.group('Admin / resources (FR-03)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('admins see every autoloaded resource in navigation, grouped and ordered', async ({
    client,
    assert,
  }) => {
    const admin = await createUser('admin')
    const response = await client.get('/admin').loginAs(admin).withInertia()

    response.assertStatus(200)
    // In navigation.groups' order (FR-16); the Overview home screen is the first link, not listed
    assert.deepEqual(response.body().props.azu.navigation, [
      SALES,
      CATALOG,
      REPORTS,
      SETTINGS,
      HELP,
    ])
    assert.deepEqual(response.body().props.azu.home, {
      name: 'overview',
      label: 'Overview',
      icon: 'layout-dashboard',
    })
  })

  test('staff do not see resources their policies hide (CategoryPolicy, OrderPolicy)', async ({
    client,
  }) => {
    const staff = await createUser('staff')
    const response = await client.get('/admin').loginAs(staff).withInertia()

    response.assertStatus(200)
    response.assertInertiaPropsContains({
      azu: {
        // CategoryPolicy and OrderPolicy are admin-only, and so are viewOrders
        // (the Awaiting shipping link), viewReports (the Sales report) and
        // manageSettings (Store settings)
        navigation: [
          { label: 'Sales', items: [COUPONS] },
          { label: 'Catalog', items: [CATALOG.items[0]] },
          HELP,
        ],
      },
    })
  })

  test('a resource link renders the placeholder with the plain-JSON schema', async ({
    client,
    assert,
  }) => {
    const admin = await createUser('admin')
    const response = await client.get('/admin/resources/products').loginAs(admin).withInertia()

    response.assertStatus(200)
    response.assertInertiaComponent('azu/resource/index')
    const { resource } = response.body().props
    assert.include(resource, {
      name: 'products',
      label: 'Products',
      singularLabel: 'Product',
      group: 'Catalog',
      title: 'name',
    })
    assert.deepEqual(resource.search, ['name', 'sku'])
    assert.deepEqual(
      resource.columns.map((c: { kind: string; name: string }) => `${c.kind}:${c.name}`),
      [
        'image:thumbnail',
        'text:name',
        'decimal:price',
        'belongsTo:category',
        'badge:status',
        'custom:stock',
      ]
    )
    // A badge column reads its values' labels from the select field of the same name
    assert.deepEqual(resource.columns[4].labels, { draft: 'Draft', published: 'Published' })
    // The README's "Customising" examples (FR-15)
    assert.include(resource.columns[5], { component: 'StockBar', label: 'In stock' })
    assert.include(resource.fields[1], { name: 'sku', component: 'SkuInput' })
    assert.deepEqual(resource.slots, {
      header: null,
      toolbar: null,
      beforeTable: null,
      afterForm: null,
    })
    assert.containsSubset(resource.columns[2], {
      sortable: true,
      format: { style: 'currency', currency: 'NGN' },
    })
    assert.include(resource.fields[3], { kind: 'belongsTo', name: 'category', searchable: 'name' })
    assert.deepEqual(resource.filters[3], {
      kind: 'custom',
      name: 'low-stock',
      label: 'Low stock',
      options: null,
    })
    assert.deepEqual(resource.actions[0], {
      kind: 'bulk',
      name: 'publish',
      label: 'Publish',
      confirm: 'Publish the selected products?',
      ability: 'publish',
      destructive: false,
      fields: [],
    })
  })

  test('the resource route checks viewList on the server, not just the navigation', async ({
    client,
  }) => {
    const staff = await createUser('staff')
    const response = await client.get('/admin/resources/orders').loginAs(staff).withInertia()

    response.assertStatus(403)
    response.assertInertiaComponent('azu/errors/forbidden')
  })

  test('customers are stopped by the access gate before any resource', async ({ client }) => {
    const customer = await createUser('customer')
    const response = await client.get('/admin/resources/products').loginAs(customer).withInertia()

    response.assertStatus(403)
    response.assertInertiaComponent('azu/errors/forbidden')
    response.assertInertiaPropsContains({ azu: { navigation: [] } })
  })

  test('an unknown resource is a 404', async ({ client }) => {
    const admin = await createUser('admin')
    const response = await client.get('/admin/resources/nope').loginAs(admin).withInertia()

    response.assertStatus(404)
    response.assertInertiaComponent('azu/errors/not_found')
  })
})
