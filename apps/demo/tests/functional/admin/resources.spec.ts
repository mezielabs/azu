import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { createUser } from './helpers.ts'

// Products before Categories, by `order` (FR-16)
const CATALOG = {
  label: 'Catalog',
  items: [
    { name: 'products', label: 'Products', icon: 'package', href: '/admin/resources/products' },
    {
      name: 'categories',
      label: 'Categories',
      icon: 'folder',
      href: '/admin/resources/categories',
    },
  ],
}
const COUPONS = {
  name: 'coupons',
  label: 'Coupons',
  icon: 'ticket',
  href: '/admin/resources/coupons',
}
// Orders before Coupons, by `order`
const SALES = {
  label: 'Sales',
  items: [
    { name: 'orders', label: 'Orders', icon: 'receipt', href: '/admin/resources/orders' },
    COUPONS,
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
    // Sales before Catalog: navigation.groups in config/admin.ts (FR-16)
    assert.deepEqual(response.body().props.azu.navigation, [SALES, CATALOG])
  })

  test('staff do not see resources their policies hide (CategoryPolicy, OrderPolicy)', async ({
    client,
  }) => {
    const staff = await createUser('staff')
    const response = await client.get('/admin').loginAs(staff).withInertia()

    response.assertStatus(200)
    response.assertInertiaPropsContains({
      azu: {
        // CategoryPolicy and OrderPolicy are admin-only
        navigation: [
          { label: 'Sales', items: [COUPONS] },
          { label: 'Catalog', items: [CATALOG.items[0]] },
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
      ['image:thumbnail', 'text:name', 'decimal:price', 'belongsTo:category', 'badge:status']
    )
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
