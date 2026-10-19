import { test } from '@japa/runner'
import { defineConfig, processTimezone } from '../src/define_config.ts'

test.group('defineConfig', () => {
  test('applies defaults', ({ assert }) => {
    assert.deepEqual(defineConfig(), {
      path: '/admin',
      entry: 'inertia/admin/app.tsx',
      guard: undefined,
      defaultDisk: undefined,
      loginUrl: '/login',
      siteUrl: '/',
      resources: { autoload: 'app/admin/resources' },
      screens: { autoload: 'app/admin/screens' },
      home: null,
      perPage: 25,
      timezone: processTimezone(),
      brand: { name: 'Admin', logo: null, color: '#2563eb' },
      navigation: { groups: [], links: [] },
    })
  })

  test('takes the navigation group order (FR-16)', ({ assert }) => {
    assert.deepEqual(defineConfig({ navigation: { groups: ['Sales', 'Catalog'] } }).navigation, {
      groups: ['Sales', 'Catalog'],
      links: [],
    })
    assert.throws(
      () => defineConfig({ navigation: { groups: 'Sales' as never } }),
      /must be a list of group labels/
    )
  })

  test('takes a brand, with a hex colour only (FR-14)', ({ assert }) => {
    assert.deepEqual(
      defineConfig({ brand: { name: ' Acme ', logo: '/images/logo.svg', color: '#26e' } }).brand,
      { name: 'Acme', logo: '/images/logo.svg', color: '#26e' }
    )
    assert.deepEqual(defineConfig({ brand: { name: '' } }).brand, {
      name: 'Admin',
      logo: null,
      color: '#2563eb',
    })
    assert.throws(() => defineConfig({ brand: { color: 'blue' } }), /must be a hex colour/)
  })

  test('takes an IANA timezone, and refuses anything else', ({ assert }) => {
    assert.equal(defineConfig({ timezone: 'Africa/Lagos' }).timezone, 'Africa/Lagos')
    assert.throws(() => defineConfig({ timezone: 'Lagos' }), /must be an IANA timezone/)
  })

  test('accepts only the list page sizes', ({ assert }) => {
    assert.equal(defineConfig({ perPage: 50 }).perPage, 50)
    assert.throws(() => defineConfig({ perPage: 30 as never }), /must be 10, 25, 50 or 100/)
  })

  test('turns resource autoload off', ({ assert }) => {
    assert.deepEqual(defineConfig({ resources: { autoload: false } }).resources, {
      autoload: false,
    })
  })

  test('keeps the guard and login URL', ({ assert }) => {
    const config = defineConfig({ guard: 'web', loginUrl: '/sign-in' })
    assert.equal(config.guard, 'web')
    assert.equal(config.loginUrl, '/sign-in')
  })

  test('normalises the path to one leading slash and no trailing slash', ({ assert }) => {
    assert.equal(defineConfig({ path: 'backoffice/' }).path, '/backoffice')
    assert.equal(defineConfig({ path: '//staff//' }).path, '/staff')
  })

  test('refuses to mount the panel at the site root', ({ assert }) => {
    assert.throws(() => defineConfig({ path: '/' }), /can't be mounted at "\/"/)
  })

  test('takes a site URL for View site, or false to hide it', ({ assert }) => {
    assert.equal(defineConfig().siteUrl, '/')
    assert.equal(defineConfig({ siteUrl: 'https://acme.test' }).siteUrl, 'https://acme.test')
    assert.isFalse(defineConfig({ siteUrl: false }).siteUrl)
    assert.throws(() => defineConfig({ siteUrl: ' ' }), /"siteUrl" in config\/azu.ts/)
  })
})
