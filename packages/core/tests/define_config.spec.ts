import { test } from '@japa/runner'
import { defineConfig } from '../src/define_config.ts'

test.group('defineConfig', () => {
  test('applies defaults', ({ assert }) => {
    assert.deepEqual(defineConfig(), {
      path: '/admin',
      entry: 'inertia/admin/app.tsx',
      guard: undefined,
      loginUrl: '/login',
      resources: { autoload: 'app/admin/resources' },
      perPage: 25,
    })
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
})
