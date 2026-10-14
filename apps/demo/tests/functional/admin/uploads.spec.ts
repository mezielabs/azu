import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import drive from '@adonisjs/drive/services/main'
import testUtils from '@adonisjs/core/services/test_utils'
import Category from '#models/category'
import Product from '#models/product'
import { createUser } from './helpers.ts'

const PRODUCTS = '/admin/resources/products'

/**
 * The smallest valid PNG: a 1x1 transparent pixel.
 */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
)

/**
 * Writes a fixture file and returns its path.
 */
async function fixture(name: string, contents: Buffer | string) {
  const dir = app.tmpPath('upload-fixtures')
  await mkdir(dir, { recursive: true })
  const path = join(dir, `${randomUUID()}-${name}`)
  await writeFile(path, contents)
  return path
}

async function createProduct(overrides: Partial<Product> = {}) {
  const category = await Category.create({ name: 'Kitchen', slug: `k-${randomUUID()}` })
  return Product.create({
    categoryId: category.id,
    name: 'Clay pot',
    sku: `T-${randomUUID().slice(0, 8)}`.toUpperCase(),
    price: '5.00',
    stock: 1,
    status: 'draft',
    isFeatured: false,
    ...overrides,
  })
}

/**
 * The form's other fields, as multipart form data sends them.
 */
function fields(product: Product) {
  return {
    name: product.name,
    sku: product.sku,
    price: '5.00',
    categoryId: String(product.categoryId),
    status: 'draft',
  }
}

test.group('Admin / image uploads (FR-07)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  let disk: ReturnType<typeof drive.fake>
  group.each.setup(() => {
    disk = drive.fake('fs')
    return () => drive.restore('fs')
  })

  test('the form shows the limits the server applies', async ({ client, assert }) => {
    const admin = await createUser('admin')
    const response = await client.get(`${PRODUCTS}/create`).loginAs(admin).withInertia()

    const field = response.body().props.form.fields.find((item: any) => item.name === 'thumbnail')
    assert.containsSubset(field, {
      kind: 'image',
      maxSize: '2mb',
      accept: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'],
    })
  })

  test('an image is checked, stored on the disk, and its key saved', async ({ client, assert }) => {
    const admin = await createUser('admin')
    const product = await createProduct()

    const response = await client
      .put(`${PRODUCTS}/${product.id}/edit`)
      .loginAs(admin)
      .withInertia()
      .withCsrfToken()
      .fields(fields(product))
      .file('thumbnail', await fixture('pot.png', PNG))
      .redirects(0)

    response.assertStatus(303)
    await product.refresh()
    assert.match(product.thumbnail!, /^products\/thumbnail\/[\w-]+\.png$/)
    disk.assertExists(product.thumbnail!)

    // The detail page links it through the disk
    const detail = await client.get(`${PRODUCTS}/${product.id}`).loginAs(admin).withInertia()
    const thumbnail = detail.body().props.record.values.thumbnail
    assert.equal(thumbnail.key, product.thumbnail)
    assert.isString(thumbnail.url)
  })

  test("the type comes from the file's bytes, not its name or headers", async ({
    client,
    assert,
  }) => {
    const admin = await createUser('admin')
    const product = await createProduct()
    // Over 4100 bytes, where the bodyparser would trust the client's claim
    const fake = await fixture('photo.png', 'not an image '.repeat(400))

    const response = await client
      .put(`${PRODUCTS}/${product.id}/edit`)
      .loginAs(admin)
      .withInertia()
      .withCsrfToken()
      .fields(fields(product))
      .file('thumbnail', fake, { contentType: 'image/png' })

    response.assertStatus(422)
    assert.match(response.body().props.errors.thumbnail[0], /must be one of these types: JPG, PNG/)
    await product.refresh()
    assert.isNull(product.thumbnail)
  })

  test('SVG is refused unless a field accepts it', async ({ client, assert }) => {
    const admin = await createUser('admin')
    const product = await createProduct()
    const svg = await fixture(
      'logo.svg',
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
    )

    const response = await client
      .put(`${PRODUCTS}/${product.id}/edit`)
      .loginAs(admin)
      .withInertia()
      .withCsrfToken()
      .fields(fields(product))
      .file('thumbnail', svg, { contentType: 'image/svg+xml' })

    response.assertStatus(422)
    assert.property(response.body().props.errors, 'thumbnail')
  })

  test('an image over maxSize is refused', async ({ client, assert }) => {
    const admin = await createUser('admin')
    const product = await createProduct()
    // A valid PNG header followed by padding past 2mb
    const big = await fixture('big.png', Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024 + 1)]))

    const response = await client
      .put(`${PRODUCTS}/${product.id}/edit`)
      .loginAs(admin)
      .withInertia()
      .withCsrfToken()
      .fields(fields(product))
      .file('thumbnail', big)

    response.assertStatus(422)
    assert.match(response.body().props.errors.thumbnail[0], /2mb or smaller/)
  })

  test('replacing an image deletes the old file; leaving it alone keeps it', async ({
    client,
    assert,
  }) => {
    const admin = await createUser('admin')
    const product = await createProduct({ thumbnail: 'products/thumbnail/old.png' })
    await drive.use('fs').put('products/thumbnail/old.png', PNG)

    // Not sent: kept
    const untouched = await client
      .put(`${PRODUCTS}/${product.id}/edit`)
      .loginAs(admin)
      .withInertia()
      .withCsrfToken()
      .json({ ...fields(product), name: 'Renamed' })
      .redirects(0)
    untouched.assertStatus(303)
    await product.refresh()
    assert.equal(product.thumbnail, 'products/thumbnail/old.png')

    // Replaced: the new one stored, the old one deleted
    const replaced = await client
      .put(`${PRODUCTS}/${product.id}/edit`)
      .loginAs(admin)
      .withInertia()
      .withCsrfToken()
      .fields(fields(product))
      .file('thumbnail', await fixture('new.png', PNG))
      .redirects(0)
    replaced.assertStatus(303)
    await product.refresh()
    assert.notEqual(product.thumbnail, 'products/thumbnail/old.png')
    disk.assertExists(product.thumbnail!)
    disk.assertMissing('products/thumbnail/old.png')
  })

  test('removing an image clears the key and deletes the file', async ({ client, assert }) => {
    const admin = await createUser('admin')
    const product = await createProduct({ thumbnail: 'products/thumbnail/old.png' })
    await drive.use('fs').put('products/thumbnail/old.png', PNG)

    const response = await client
      .put(`${PRODUCTS}/${product.id}/edit`)
      .loginAs(admin)
      .withInertia()
      .withCsrfToken()
      .json({ ...fields(product), thumbnail: null })
      .redirects(0)

    response.assertStatus(303)
    await product.refresh()
    assert.isNull(product.thumbnail)
    disk.assertMissing('products/thumbnail/old.png')
  })

  test('a failed save stores nothing', async ({ client, assert }) => {
    const admin = await createUser('admin')
    const product = await createProduct()

    // Valid image, invalid price: the validator fails, so the file isn't stored
    const response = await client
      .put(`${PRODUCTS}/${product.id}/edit`)
      .loginAs(admin)
      .withInertia()
      .withCsrfToken()
      .fields({ ...fields(product), price: 'free' })
      .file('thumbnail', await fixture('pot.png', PNG))

    response.assertStatus(422)
    assert.deepEqual(Object.keys(response.body().props.errors), ['price'])
    const stored = await drive.use('fs').listAll('products/thumbnail')
    assert.lengthOf([...stored.objects], 0)
  })

  test('the list shows thumbnails through the disk', async ({ client, assert }) => {
    const admin = await createUser('admin')
    const product = await createProduct({
      name: `Thumb ${randomUUID().slice(0, 6)}`,
      thumbnail: 'products/thumbnail/a.png',
    })

    const response = await client
      .get(`${PRODUCTS}?search=${encodeURIComponent(product.name)}`)
      .loginAs(admin)
      .withInertia()

    const [row] = response.body().props.list.rows
    assert.isString(row.cells.thumbnail.url)
    assert.include(row.cells.thumbnail.url, 'products/thumbnail/a.png')
  })
})

test.group('Admin / rich text (FR-07)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('rich text is sanitised before the validator and the database', async ({
    client,
    assert,
  }) => {
    const admin = await createUser('admin')
    const product = await createProduct()

    const response = await client
      .put(`${PRODUCTS}/${product.id}/edit`)
      .loginAs(admin)
      .withInertia()
      .withCsrfToken()
      .json({
        ...fields(product),
        description:
          '<p onclick="steal()">Hand <strong>made</strong></p><script>alert(1)</script>' +
          '<img src=x onerror=alert(1)><a href="javascript:alert(1)">link</a>',
      })
      .redirects(0)

    response.assertStatus(303)
    await product.refresh()
    assert.equal(product.description, '<p>Hand <strong>made</strong></p><a>link</a>')
  })

  test('rich text written outside Azu is sanitised before it is shown', async ({
    client,
    assert,
  }) => {
    const admin = await createUser('admin')
    const product = await createProduct({
      description: '<p>Safe</p><script>alert(1)</script><iframe src="//evil"></iframe>',
    })

    const detail = await client.get(`${PRODUCTS}/${product.id}`).loginAs(admin).withInertia()
    assert.equal(detail.body().props.record.values.description, '<p>Safe</p>')

    const edit = await client.get(`${PRODUCTS}/${product.id}/edit`).loginAs(admin).withInertia()
    assert.equal(edit.body().props.form.values.description, '<p>Safe</p>')
  })
})
