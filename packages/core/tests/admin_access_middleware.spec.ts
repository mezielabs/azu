import { test } from '@japa/runner'
import type { HttpContext } from '@adonisjs/core/http'
import { AdminAccessMiddleware } from '../src/middleware/admin_access_middleware.ts'
import { defineConfig } from '../src/define_config.ts'

type FakeOptions = {
  /** undefined: no auth set up at all */
  authenticated?: boolean
  bouncer?: { allows(ability: string): Promise<boolean> }
  inertia?: boolean
}

/**
 * Just enough of HttpContext for the gate, recording what it did.
 */
function fakeContext(options: FakeOptions) {
  const calls = {
    guard: undefined as string | undefined,
    redirect: undefined as string | undefined,
    location: undefined as string | undefined,
    status: undefined as number | undefined,
    rendered: undefined as { page: string; props: unknown } | undefined,
    sent: undefined as unknown,
    warnings: [] as string[],
  }
  const ctx = {
    auth:
      options.authenticated === undefined
        ? undefined
        : {
            use(guard?: string) {
              calls.guard = guard
              return { check: async () => options.authenticated! }
            },
          },
    bouncer: options.bouncer,
    request: {
      header: (name: string) => (name === 'x-inertia' && options.inertia ? 'true' : null),
    },
    response: {
      redirect: (url: string) => (calls.redirect = url),
      status(code: number) {
        calls.status = code
        return this
      },
      send: (body: unknown) => (calls.sent = body),
    },
    inertia: {
      location: (url: string) => (calls.location = url),
      render: async (page: string, props: unknown) => {
        calls.rendered = { page, props }
        return `<rendered ${page}>`
      },
    },
    logger: { warn: (...args: unknown[]) => calls.warnings.push(String(args.at(-1))) },
  }
  return { ctx: ctx as unknown as HttpContext, calls }
}

const allow = { allows: async (ability: string) => ability === 'accessAdmin' }
const deny = { allows: async () => false }

async function run(options: FakeOptions, config = defineConfig()) {
  const { ctx, calls } = fakeContext(options)
  let nextCalled = false
  await new AdminAccessMiddleware(config).handle(ctx, async () => {
    nextCalled = true
  })
  return { ...calls, nextCalled }
}

test.group('AdminAccessMiddleware (FR-02)', () => {
  test('redirects guests to the login URL', async ({ assert }) => {
    const result = await run({ authenticated: false, bouncer: allow })

    assert.equal(result.redirect, '/login')
    assert.isFalse(result.nextCalled)
  })

  test('sends guests on Inertia visits a location response, not a redirect', async ({ assert }) => {
    const result = await run({ authenticated: false, bouncer: allow, inertia: true })

    assert.equal(result.location, '/login')
    assert.isUndefined(result.redirect)
    assert.isFalse(result.nextCalled)
  })

  test('uses the configured guard and login URL', async ({ assert }) => {
    const result = await run(
      { authenticated: false, bouncer: allow },
      defineConfig({ guard: 'admin', loginUrl: '/staff/sign-in' })
    )

    assert.equal(result.guard, 'admin')
    assert.equal(result.redirect, '/staff/sign-in')
  })

  test('uses the app default guard when none is configured', async ({ assert }) => {
    const result = await run({ authenticated: true, bouncer: allow })

    assert.isUndefined(result.guard)
  })

  test('forbids signed-in users who fail accessAdmin', async ({ assert }) => {
    const result = await run({ authenticated: true, bouncer: deny })

    assert.equal(result.status, 403)
    assert.deepEqual(result.rendered, {
      page: 'azu/errors/forbidden',
      props: { azu: { path: '/admin', navigation: [] } },
    })
    assert.equal(result.sent, '<rendered azu/errors/forbidden>')
    assert.isFalse(result.nextCalled)
  })

  test('lets through signed-in users who pass accessAdmin', async ({ assert }) => {
    const result = await run({ authenticated: true, bouncer: allow })

    assert.isTrue(result.nextCalled)
    assert.isUndefined(result.status)
  })

  test('fails closed when Bouncer is not set up', async ({ assert }) => {
    const result = await run({ authenticated: true })

    assert.equal(result.status, 403)
    assert.isFalse(result.nextCalled)
    assert.match(result.warnings[0], /node ace add @adonisjs\/bouncer/)
  })

  test('fails closed when the accessAdmin ability is missing', async ({ assert }) => {
    const bouncer = {
      allows: async () => {
        throw new Error('Invalid bouncer ability "accessAdmin"')
      },
    }
    const result = await run({ authenticated: true, bouncer })

    assert.equal(result.status, 403)
    assert.isFalse(result.nextCalled)
    assert.match(result.warnings[0], /accessAdmin/)
  })

  test('fails closed when auth is not set up', async ({ assert }) => {
    const result = await run({ bouncer: allow })

    assert.equal(result.status, 403)
    assert.isFalse(result.nextCalled)
    assert.match(result.warnings[0], /@adonisjs\/auth/)
  })
})
