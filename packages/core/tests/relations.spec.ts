import { test } from '@japa/runner'
import type { HttpContext } from '@adonisjs/core/http'
import type { LucidModel, LucidRow } from '@adonisjs/lucid/types/model'
import { Azu } from '../src/azu.ts'
import { defineConfig } from '../src/define_config.ts'
import { formFields } from '../src/forms/form_fields.ts'
import { hasManyTables } from '../src/records/relations.ts'
import { defineResource } from '../src/resources/define_resource.ts'
import { field } from '../src/resources/fields.ts'

/**
 * A model that must not be queried: the policy check comes first.
 */
function untouchable(name: string) {
  return {
    name,
    primaryKey: 'id',
    $getRelation: () => undefined,
    query: () => {
      throw new Error(`${name} was queried`)
    },
  } as unknown as LucidModel
}

/**
 * A stand-in Lucid model with `hasMany products` and `belongsTo
 * category` relations, as Lucid describes them.
 */
function parentModel(related: Record<string, LucidModel>) {
  const relations: Record<string, object> = {
    products: {
      type: 'hasMany',
      booted: true,
      boot() {},
      relatedModel: () => related.products,
      foreignKey: 'categoryId',
      localKey: 'id',
      foreignKeyColumnName: 'category_id',
      localKeyColumnName: 'id',
    },
    category: {
      type: 'belongsTo',
      booted: true,
      boot() {},
      relatedModel: () => related.category,
      foreignKey: 'categoryId',
      localKey: 'id',
      foreignKeyColumnName: 'category_id',
      localKeyColumnName: 'id',
    },
  }
  return {
    name: 'Parent',
    $getRelation: (name: string) => relations[name],
  } as unknown as LucidModel
}

class Policy {
  viewList() {}
  create() {}
}

function request(allowed: string[]) {
  const warnings: string[] = []
  const ctx = {
    request: { qs: () => ({}) },
    logger: { warn: (message: string) => warnings.push(message) },
    bouncer: { with: () => ({ allows: async (ability: string) => allowed.includes(ability) }) },
  } as unknown as HttpContext
  return { ctx, warnings }
}

test.group('Relations', () => {
  test('a hasMany table is hidden, unqueried, when the related viewList denies', async ({
    assert,
  }) => {
    const products = untouchable('Product')
    const azu = new Azu().register(defineResource(products, { policy: Policy } as never))
    const parent = defineResource(parentModel({ products }), {
      policy: Policy,
      fields: [field.hasMany('products')],
    } as never)
    const { ctx } = request(['create'])

    const tables = await hasManyTables(
      ctx,
      { azu, config: defineConfig() },
      parent,
      parent.toSchema().fields,
      { id: 1 } as unknown as LucidRow
    )
    assert.deepEqual(tables, [])
  })

  test('a hasMany table without a resource for its model is skipped, with a warning', async ({
    assert,
  }) => {
    const products = untouchable('Product')
    const parent = defineResource(parentModel({ products }), {
      policy: Policy,
      fields: [field.hasMany('products')],
    } as never)
    const { ctx, warnings } = request(['viewList'])

    const tables = await hasManyTables(
      ctx,
      { azu: new Azu(), config: defineConfig() },
      parent,
      parent.toSchema().fields,
      { id: 1 } as unknown as LucidRow
    )
    assert.deepEqual(tables, [])
    assert.match(warnings[0], /no resource is registered for Product/)
  })

  test("a belongsTo field's input is its foreign key", async ({ assert }) => {
    const parent = defineResource(parentModel({ category: untouchable('Category') }), {
      policy: Policy,
      fields: [field.belongsTo('category').searchable('name'), field.text('name')],
    } as never)
    const { ctx } = request(['create'])

    const fields = await formFields(ctx, parent, 'create')
    assert.deepEqual(
      fields.map((item) => [item.name, item.input]),
      [
        ['category', 'categoryId'],
        ['name', 'name'],
      ]
    )
  })
})
