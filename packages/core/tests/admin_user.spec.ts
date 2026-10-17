import { test } from '@japa/runner'
import type { HttpContext } from '@adonisjs/core/http'
import { adminUser, logout } from '../src/auth/admin_user.ts'

function context(
  guard: { user?: unknown; logout?: () => Promise<void> } | null,
  options: { inertia?: boolean } = {}
) {
  const calls = {
    guard: undefined as string | undefined,
    redirect: '',
    location: '',
    warned: false,
  }
  const ctx = {
    auth: guard && {
      use(name?: string) {
        calls.guard = name
        return guard
      },
    },
    request: {
      header: (name: string) => (name === 'x-inertia' && options.inertia ? 'true' : null),
    },
    response: { redirect: (url: string) => (calls.redirect = url) },
    inertia: { location: (url: string) => (calls.location = url) },
    logger: { warn: () => (calls.warned = true) },
  }
  return { ctx: ctx as unknown as HttpContext, calls }
}

test.group('The signed-in user (sidebar)', () => {
  test('reads fullName, else name, and email from the guard', ({ assert }) => {
    const config = { guard: 'web' }
    assert.deepEqual(
      adminUser(context({ user: { fullName: ' Ada Admin ', email: 'ada@azu.test' } }).ctx, config),
      { name: 'Ada Admin', email: 'ada@azu.test' }
    )
    assert.deepEqual(adminUser(context({ user: { name: 'Ada', email: '' } }).ctx, config), {
      name: 'Ada',
      email: null,
    })
    assert.deepEqual(adminUser(context({ user: { email: 'ada@azu.test' } }).ctx, config), {
      name: null,
      email: 'ada@azu.test',
    })
  })

  test('is null for a guest or without auth', ({ assert }) => {
    assert.isNull(adminUser(context({ user: undefined }).ctx, { guard: undefined }))
    assert.isNull(adminUser(context(null).ctx, { guard: undefined }))
  })
})

test.group('Sign out', () => {
  test("signs out of the admin's guard and goes to the login page", async ({ assert }) => {
    let signedOut = false
    const { ctx, calls } = context({ logout: async () => void (signedOut = true) })

    await logout(ctx, { guard: 'admin', loginUrl: '/staff/sign-in' })

    assert.isTrue(signedOut)
    assert.equal(calls.guard, 'admin')
    assert.equal(calls.redirect, '/staff/sign-in')
  })

  test('an Inertia visit leaves the admin app with a location response', async ({ assert }) => {
    const { ctx, calls } = context({ logout: async () => {} }, { inertia: true })

    await logout(ctx, { guard: undefined, loginUrl: '/login' })

    assert.equal(calls.location, '/login')
    assert.equal(calls.redirect, '')
  })

  test('a guard without logout is left alone, and logged', async ({ assert }) => {
    const { ctx, calls } = context({})

    await logout(ctx, { guard: undefined, loginUrl: '/login' })

    assert.isTrue(calls.warned)
    assert.equal(calls.redirect, '/login')
  })
})
