import { test } from '@japa/runner'
import { Logger } from '@adonisjs/core/logger'
import type { HttpContext } from '@adonisjs/core/http'
import { Database } from '@adonisjs/lucid/database'
import { BaseModel, belongsTo, column, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, ManyToMany } from '@adonisjs/lucid/types/relations'
import vine from '@vinejs/vine'
import { Azu } from '../src/azu.ts'
import { defineConfig } from '../src/define_config.ts'
import { formFields } from '../src/forms/form_fields.ts'
import { saveRecord } from '../src/forms/save_record.ts'
import { selectedRelations } from '../src/list/filters.ts'
import {
  manyToManyCount,
  manyToManyIds,
  manyToManyReadOnlyReason,
  relationOptions,
  relationValues,
} from '../src/records/relations.ts'
import { defineResource } from '../src/resources/define_resource.ts'
import { field } from '../src/resources/fields.ts'
import { filter } from '../src/resources/filters.ts'

class Policy {
  update() {}
  view() {}
}

test.group('Custom Lucid relation keys', (group) => {
  let db: Database
  group.each.setup(() => {
    db = new Database(
      {
        connection: 'sqlite',
        connections: {
          sqlite: {
            client: 'better-sqlite3',
            connection: { filename: ':memory:' },
            useNullAsDefault: true,
          },
        },
      },
      new Logger({ name: 'relation-key-test', enabled: false }),
      { emit() {}, hasListeners: () => false } as never
    )
    return () => db.manager.closeAll()
  })

  test('pickers, filters and saves use relation keys; detail links use primary keys', async ({
    assert,
  }) => {
    class Model extends BaseModel {
      static $adapter = db.modelAdapter()
    }
    class Category extends Model {
      static table = 'categories'
      @column({ isPrimary: true }) declare id: number
      @column() declare code: string
      @column() declare name: string
    }
    class Tag extends Model {
      static table = 'tags'
      @column({ isPrimary: true }) declare id: number
      @column() declare code: string
      @column() declare name: string
    }
    class Product extends Model {
      static table = 'products'
      @column({ isPrimary: true }) declare id: number
      @column() declare categoryCode: string
      @belongsTo(() => Category, { foreignKey: 'categoryCode', localKey: 'code' })
      declare category: BelongsTo<typeof Category>
      @manyToMany(() => Tag, {
        relatedKey: 'code',
        pivotTable: 'product_tag',
        pivotForeignKey: 'product_id',
        pivotRelatedForeignKey: 'tag_code',
      })
      declare tags: ManyToMany<typeof Tag>
    }
    await db.connection().schema.createTable('categories', (table) => {
      table.increments('id')
      table.string('code').unique().notNullable()
      table.string('name')
    })
    await db.connection().schema.createTable('tags', (table) => {
      table.increments('id')
      table.string('code').unique().notNullable()
      table.string('name')
    })
    await db.connection().schema.createTable('products', (table) => {
      table.increments('id')
      table.string('category_code').references('code').inTable('categories')
    })
    await db.connection().schema.createTable('product_tag', (table) => {
      table.integer('product_id').references('id').inTable('products')
      table.string('tag_code').references('code').inTable('tags')
      table.unique(['product_id', 'tag_code'])
    })

    const [kitchen, garden] = await Category.createMany([
      { code: 'kitchen', name: 'Kitchen' },
      { code: 'garden', name: 'Garden' },
    ])
    const [clay, gift] = await Tag.createMany([
      { code: 'clay', name: 'Clay' },
      { code: 'gift', name: 'Gift' },
    ])
    const product = await Product.create({ categoryCode: kitchen.code })
    await product.related('tags').attach([clay.code])
    const resource = defineResource(Product, {
      policy: Policy,
      fields: [field.belongsTo('category'), field.manyToMany('tags')],
      filters: [filter.belongsTo('category')],
      validators: {
        update: vine.compile(
          vine.object({
            categoryCode: vine.string().in([kitchen.code, garden.code]),
            tagIds: vine.array(vine.string().in([clay.code, gift.code])),
          })
        ),
      },
    })
    const context = {
      config: defineConfig(),
      azu: new Azu().register(
        resource,
        defineResource(Category, { title: 'name', policy: Policy }),
        defineResource(Tag, { title: 'name', policy: Policy })
      ),
    }
    let body: Record<string, unknown> = {}
    const ctx = {
      request: { body: () => body },
      bouncer: { with: () => ({ allows: async () => true }) },
    } as unknown as HttpContext
    const fields = await formFields(ctx, resource, 'edit', product)
    const values = await relationValues(ctx, context, Product, fields, product)
    assert.deepEqual(values, {
      category: {
        id: kitchen.code,
        title: kitchen.name,
        href: `/admin/resources/categories/${kitchen.id}`,
      },
      tags: [{ id: clay.code, title: clay.name, href: `/admin/resources/tags/${clay.id}` }],
    })
    assert.deepEqual(await relationOptions(context, Product, fields[0], ''), [
      { id: garden.code, title: garden.name },
      { id: kitchen.code, title: kitchen.name },
    ])
    assert.deepEqual(await relationOptions(context, Product, fields[1], ''), [
      { id: clay.code, title: clay.name },
      { id: gift.code, title: gift.name },
    ])
    const selected = await selectedRelations(context, resource, resource.toSchema().filters, {
      category: kitchen.code,
    })
    assert.deepEqual(selected.selected.category, { id: kitchen.code, title: kitchen.name })
    assert.deepEqual(await manyToManyIds(Product, product, 'tags'), [clay.code])

    // Unchanged form submission round-trips the custom keys.
    body = { categoryCode: kitchen.code, tagIds: [clay.code] }
    const unchanged = await saveRecord(ctx, resource, 'edit', fields, { record: product })
    assert.isUndefined(unchanged.errors)
    await product.refresh()
    assert.equal(product.categoryCode, kitchen.code)
    assert.deepEqual(await manyToManyIds(Product, product, 'tags'), [clay.code])

    body = { categoryCode: garden.code, tagIds: [gift.code] }
    const changed = await saveRecord(ctx, resource, 'edit', fields, { record: product })
    assert.isUndefined(changed.errors)
    await product.refresh()
    assert.equal(product.categoryCode, garden.code)
    assert.deepEqual(await manyToManyIds(Product, product, 'tags'), [gift.code])

    // A read-only relation feeds its real keys to the required validator,
    // ignoring even a forged empty transport marker.
    body = { categoryCode: garden.code, tagIds: '[]' }
    const readOnly = fields.map((item) =>
      item.kind === 'manyToMany' ? { ...item, readOnly: true } : item
    )
    const preserved = await saveRecord(ctx, resource, 'edit', readOnly, { record: product })
    assert.isUndefined(preserved.errors)
    assert.deepEqual(await manyToManyIds(Product, product, 'tags'), [gift.code])
  })

  test('duplicate pivot rows count once for editability, including custom related keys', async ({
    assert,
  }) => {
    class Tag extends BaseModel {
      static $adapter = db.modelAdapter()
      static table = 'tags'
      @column({ isPrimary: true }) declare id: number
      @column() declare code: string
      @column() declare name: string
    }
    class Product extends BaseModel {
      static $adapter = db.modelAdapter()
      static table = 'products'
      @column({ isPrimary: true }) declare id: number
      @manyToMany(() => Tag, {
        relatedKey: 'code',
        pivotTable: 'product_tag',
        pivotForeignKey: 'product_id',
        pivotRelatedForeignKey: 'tag_code',
      })
      declare tags: ManyToMany<typeof Tag>
    }
    await db.connection().schema.createTable('tags', (table) => {
      table.increments('id')
      table.string('code').unique().notNullable()
      table.string('name')
    })
    await db.connection().schema.createTable('products', (table) => {
      table.increments('id')
    })
    // Apps may have pivot tables without a unique constraint.
    await db.connection().schema.createTable('product_tag', (table) => {
      table.integer('product_id')
      table.string('tag_code')
    })
    const tag = await Tag.create({ code: 'clay', name: 'Clay' })
    const product = await Product.create({})
    const other = await Product.create({})
    await product.related('tags').attach([tag.code])
    await product.related('tags').attach([tag.code])
    const related = defineResource(Tag, { title: 'name', policy: Policy })
    const context = { config: defineConfig(), azu: new Azu().register(related) }
    const tags = field.manyToMany('tags').label('Product tags').toJSON()
    assert.equal(await manyToManyCount(Product, product, 'tags'), 1)
    assert.isNull(await manyToManyReadOnlyReason(context, Product, tags, product))

    // Even more than 200 duplicate rows are still one attached key.
    await db.table('product_tag').multiInsert(
      Array.from({ length: 200 }, () => ({
        product_id: product.id,
        tag_code: tag.code,
      }))
    )
    const hidden = await Tag.create({ code: 'gift', name: 'Gift' })
    await other.related('tags').attach([hidden.code])
    assert.equal(await manyToManyCount(Product, product, 'tags'), 1)
    assert.isNull(await manyToManyReadOnlyReason(context, Product, tags, product))
    // Duplicates cannot disguise a genuinely hidden key.
    related.options.query = (query) => {
      query.where('tags.code', hidden.code)
    }
    assert.equal(
      await manyToManyReadOnlyReason(context, Product, tags, product),
      "Some attached product tags are hidden from you, so this field can't be edited here."
    )
  })
})
