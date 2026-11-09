import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import Product from '#models/product'
import demo from '#config/demo'
import { clearRateLimits, demoAccount } from './helpers.ts'

/**
 * The public demo's limits (DEMO_MODE): write requests per IP, a 1 MB
 * upload cap, noindex everywhere, and the banner's cookie.
 */
test.group('Demo / limits', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => clearRateLimits())
  group.teardown(() => clearRateLimits())

  test('GET /health reports a healthy app', async ({ client, assert }) => {
    const response = await client.get('/health')

    response.assertStatus(200)
    assert.isTrue(response.body().isHealthy)
  })

  test('every response says noindex: pages, static files and 404s', async ({ client }) => {
    for (const url of ['/login', '/images/logo.svg', '/no-such-page']) {
      const response = await client.get(url)
      response.assertHeader('x-robots-tag', 'noindex, nofollow')
    }
  })

  test('responses carry the reset time for the admin banner', async ({ client, assert }) => {
    const response = await client.get('/login')
    const cookies = ([] as string[]).concat(response.header('set-cookie') ?? [])
    const cookie = cookies.find((line) => line.startsWith('azu_demo='))
    assert.exists(cookie)
    // "60|<ISO time>", not httpOnly, so the banner can read it
    assert.match(decodeURIComponent(cookie!.split(';')[0]), /^azu_demo=60\|\d{4}-\d{2}-\d{2}T/)
    assert.notMatch(cookie!, /httponly/i)
  })

  test('write requests are limited per IP address; reads are not', async ({ client }) => {
    for (let i = 0; i < demo.writeLimit.requests; i++) {
      const response = await client.post('/demo/sign-in/viewer').withCsrfToken().redirects(0)
      response.assertStatus(302)
    }

    const limited = await client.post('/demo/sign-in/viewer').withCsrfToken().redirects(0)
    limited.assertStatus(429)
    limited.assertHeader('retry-after', limited.header('retry-after'))

    const read = await client.get('/login')
    read.assertStatus(200)
  })

  test('uploads over 1 MB are refused', async ({ client, assert }) => {
    const admin = await demoAccount('admin')
    const product = await Product.query().orderBy('id').firstOrFail()
    const dir = app.tmpPath('upload-fixtures')
    await mkdir(dir, { recursive: true })
    const path = join(dir, 'demo-too-big.png')
    await writeFile(path, randomBytes(1024 * 1024 + 1))

    const response = await client
      .put(`/admin/resources/products/${product.id}/edit`)
      .loginAs(admin)
      .withInertia()
      .withCsrfToken()
      .field('name', product.name)
      .file('thumbnail', path)

    response.assertStatus(413)
    await product.refresh()
    assert.notMatch(product.thumbnail ?? '', /^products\//)
  })
})
