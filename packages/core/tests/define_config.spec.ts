import { test } from '@japa/runner'
import { defineConfig } from '../src/define_config.ts'

test.group('defineConfig', () => {
  test('applies defaults', ({ assert }) => {
    assert.deepEqual(defineConfig(), {
      path: '/admin',
      entry: 'inertia/admin/app.tsx',
      guard: undefined,
      loginUrl: '/login',
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
