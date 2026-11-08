import { test } from '@japa/runner'
import type { HttpContext } from '@adonisjs/core/http'
import type { Database } from '@adonisjs/lucid/database'
import { BaseModel, belongsTo, column, manyToMany } from '@adonisjs/lucid/orm'
import type { LucidRow } from '@adonisjs/lucid/types/model'
import type { BelongsTo, ManyToMany } from '@adonisjs/lucid/types/relations'
import { Azu } from '../src/azu.ts'
import { defineConfig } from '../src/define_config.ts'
import { detailFields, formFields } from '../src/forms/form_fields.ts'
import { manyToManyReadOnlyReason, relationValues } from '../src/records/relations.ts'
import { defineResource } from '../src/resources/define_resource.ts'
import { field } from '../src/resources/fields.ts'
import { testDatabase } from './helpers/test_database.ts'

class Policy {
  viewList() {}
  view() {}
  update() {}
}

const TABLES = ['m2m_hook_product_tag', 'm2m_hook_tags', 'm2m_hook_products', 'm2m_hook_categories']

/**
 * #79: a `manyToMany` field whose related resource's `query` hook
 * preloads a `belongsTo`, as the docs suggest the hook for. On SQLite, or
 * on Postgres or MySQL with `DB_CONNECTION`, as CI's matrix runs it.
 */
test.group('manyToMany fields through a query hook with preloads (#79)', (group) => {
  let db: Database
  group.each.setup(async () => {
    db = testDatabase('many-to-many-hooks-test')
    const drop = async () => {
      for (const table of TABLES) await db.connection().schema.dropTableIfExists(table)
    }
    await drop()
    return async () => {
      await drop()
      await db.manager.closeAll()
    }
  })

  async function setup() {
    class Model extends BaseModel {
      static $adapter = db.modelAdapter()
    }
    class Category extends Model {
      static table = 'm2m_hook_categories'
      @column({ isPrimary: true }) declare id: number
      @column() declare name: string
    }
    class Product extends Model {
      static table = 'm2m_hook_products'
      @column({ isPrimary: true }) declare id: number
      @column() declare name: string
      @column() declare categoryId: number
      @column() declare active: boolean
      @belongsTo(() => Category) declare category: BelongsTo<typeof Category>
    }
    class Tag extends Model {
      static table = 'm2m_hook_tags'
      @column({ isPrimary: true }) declare id: number
      @column() declare name: string
      @manyToMany(() => Product, {
        pivotTable: 'm2m_hook_product_tag',
        pivotForeignKey: 'tag_id',
        pivotRelatedForeignKey: 'product_id',
      })
      declare products: ManyToMany<typeof Product>
    }

    // A fresh schema builder per table: one builder repeats earlier statements
    const schema = () => db.connection().schema
    await schema().createTable('m2m_hook_categories', (table) => {
      table.increments('id')
      table.string('name')
    })
    await schema().createTable('m2m_hook_products', (table) => {
      table.increments('id')
      table.string('name')
      table.integer('category_id').unsigned().references('id').inTable('m2m_hook_categories')
      table.boolean('active')
    })
    await schema().createTable('m2m_hook_tags', (table) => {
      table.increments('id')
      table.string('name')
    })
    await schema().createTable('m2m_hook_product_tag', (table) => {
      table.integer('tag_id').unsigned().references('id').inTable('m2m_hook_tags')
      table.integer('product_id').unsigned().references('id').inTable('m2m_hook_products')
    })

    const kitchen = await Category.create({ name: 'Kitchen' })
    const [bowl, cup, retired] = await Product.createMany([
      { name: 'Bowl', categoryId: kitchen.id, active: true },
      { name: 'Cup', categoryId: kitchen.id, active: true },
      { name: 'Retired jug', categoryId: kitchen.id, active: false },
    ])
    const [gift, clay] = await Tag.createMany([{ name: 'Gift' }, { name: 'Clay' }])
    await gift.related('products').attach([cup.id, bowl.id])
    // Clay is also on a product the hook's scope hides
    await clay.related('products').attach([bowl.id, retired.id])

    const products = defineResource(Product, {
      title: 'name',
      policy: Policy,
      query: (query) => query.preload('category').where('m2m_hook_products.active', true),
    })
    const tags = defineResource(Tag, {
      title: 'name',
      policy: Policy,
      fields: [field.text('name'), field.manyToMany('products')],
    })
    const context = { config: defineConfig(), azu: new Azu().register(products, tags) }

    // Every record a `view` check sees, to check it has the hook's preloads
    const viewed: LucidRow[] = []
    const ctx = {
      bouncer: {
        with: () => ({
          allows: async (ability: string, record?: LucidRow) => {
            if (ability === 'view' && record) viewed.push(record)
            return true
          },
        }),
      },
      logger: { warn() {} },
    } as unknown as HttpContext

    const link = (product: { id: number; name: string }) => ({
      id: product.id,
      title: product.name,
      href: `/admin/resources/${products.name}/${product.id}`,
    })
    return { Tag, tags, context, ctx, viewed, link, bowl, cup, gift, clay }
  }

  test('the detail page lists the attached records, by title', async ({ assert }) => {
    const { Tag, tags, context, ctx, viewed, link, bowl, cup, gift } = await setup()

    const fields = await detailFields(ctx, tags, gift)
    const values = await relationValues(ctx, context, Tag, fields, gift)

    assert.deepEqual(values, { products: [link(bowl), link(cup)] })
    // The `view` checks get full records, with the hook's preloads
    assert.lengthOf(viewed, 2)
    for (const record of viewed) {
      assert.equal((record as unknown as { category: { name: string } }).category.name, 'Kitchen')
    }
  })

  test('the edit page loads the attached records, and the field stays editable', async ({
    assert,
  }) => {
    const { Tag, tags, context, ctx, link, bowl, cup, gift } = await setup()

    const fields = await formFields(ctx, tags, 'edit', gift)
    const products = fields.find((item) => item.name === 'products')!
    assert.isNull(await manyToManyReadOnlyReason(context, Tag, products, gift))
    const values = await relationValues(ctx, context, Tag, fields, gift)
    assert.deepEqual(values, { products: [link(bowl), link(cup)] })
  })

  test("the hook's where-constraints still hide out-of-scope records", async ({ assert }) => {
    const { Tag, tags, context, ctx, link, bowl, clay } = await setup()

    const fields = await formFields(ctx, tags, 'edit', clay)
    const values = await relationValues(ctx, context, Tag, fields, clay)
    assert.deepEqual(values, { products: [link(bowl)] })
    const products = fields.find((item) => item.name === 'products')!
    assert.equal(
      await manyToManyReadOnlyReason(context, Tag, products, clay),
      "Some attached products are hidden from you, so this field can't be edited here."
    )
  })
})
