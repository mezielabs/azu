import { test } from '@japa/runner'
import type { LucidModel } from '@adonisjs/lucid/types/model'
import { baseType, declaredTypes, literalUnion } from '../src/generator/declared_types.ts'
import { checkEnums, type DbColumn } from '../src/generator/introspect_db.ts'
import { planModel, type FieldPlan, type ModelPlan } from '../src/generator/model_info.ts'
import {
  renderPolicy,
  renderResource,
  renderValidator,
  type Names,
} from '../src/generator/render.ts'

const column = (name: string, overrides: Partial<DbColumn> = {}): DbColumn => ({
  name,
  type: 'string',
  maxLength: null,
  precision: null,
  scale: null,
  nullable: false,
  hasDefault: false,
  enumValues: null,
  unique: false,
  references: null,
  ...overrides,
})

const fieldPlan = (
  overrides: Partial<FieldPlan> & Pick<FieldPlan, 'name' | 'kind'>
): FieldPlan => ({
  input: overrides.name,
  column: column(overrides.name),
  options: null,
  relation: null,
  ...overrides,
})

/**
 * Comment text with its line wraps removed
 */
const unwrap = (source: string) => source.replace(/\n \* /g, ' ')

const names: Names = {
  model: 'Product',
  modelImport: '#models/product',
  policy: 'ProductPolicy',
  policyImport: '#policies/product_policy',
  createValidator: 'createProductValidator',
  updateValidator: 'updateProductValidator',
  validatorImport: '#validators/product_admin',
  command: 'node ace azu:resource Product --policy',
}

function plan(fields: FieldPlan[], overrides: Partial<ModelPlan> = {}): ModelPlan {
  return {
    model: {} as LucidModel,
    table: 'products',
    primaryKey: 'id',
    primaryKeyColumn: 'id',
    fields,
    title: 'name',
    search: ['name', 'sku'],
    createdAt: 'createdAt',
    uncovered: [],
    skipped: [],
    ...overrides,
    manyToMany: overrides.manyToMany ?? [],
  }
}

const product = plan([
  fieldPlan({
    name: 'category',
    input: 'categoryId',
    kind: 'belongsTo',
    column: column('category_id', {
      type: 'integer',
      references: { table: 'categories', column: 'id' },
    }),
    relation: {
      name: 'category',
      related: {} as LucidModel,
      relatedTable: 'categories',
      relatedKeyColumn: 'id',
      title: 'name',
    },
  }),
  fieldPlan({ name: 'name', kind: 'text', column: column('name', { maxLength: 160 }) }),
  fieldPlan({ name: 'sku', kind: 'text', column: column('sku', { maxLength: 40, unique: true }) }),
  fieldPlan({
    name: 'description',
    kind: 'richText',
    column: column('description', { type: 'text', nullable: true }),
  }),
  fieldPlan({
    name: 'price',
    kind: 'decimal',
    column: column('price', { type: 'decimal', precision: 12, scale: 2 }),
  }),
  fieldPlan({
    name: 'stock',
    kind: 'number',
    column: column('stock', { type: 'integer', hasDefault: true }),
  }),
  fieldPlan({
    name: 'status',
    kind: 'select',
    options: ['draft', 'published'],
    column: column('status', { hasDefault: true }),
  }),
])

test.group('Generator / declared types', () => {
  test('reads a model and the schema class it extends', async ({ assert, fs }) => {
    await fs.create(
      'app/models/user.ts',
      [
        "import { UserSchema } from '#database/schema'",
        'export default class User extends compose(UserSchema, withAuthFinder(hash)) {',
        '  declare nickname: string | null',
        '}',
      ].join('\n')
    )
    await fs.create(
      'database/schema.ts',
      [
        'export class UserSchema extends BaseModel {',
        '  @column()',
        "  declare role: 'admin' | 'staff'",
        '  @column()',
        '  declare age: number',
        '}',
      ].join('\n')
    )
    const types = await declaredTypes(
      fs.basePath + '/app/models/user.ts',
      fs.basePath + '/database/schema.ts'
    )
    assert.deepEqual(Object.fromEntries(types), {
      role: "'admin' | 'staff'",
      age: 'number',
      nickname: 'string | null',
    })
  })

  test('literal unions are select options; base types drop null', ({ assert }) => {
    assert.deepEqual(literalUnion("'draft' | 'published' | null"), ['draft', 'published'])
    assert.isNull(literalUnion('string'))
    assert.equal(baseType('string | null'), 'string')
    assert.equal(baseType("'a' | 'b'"), 'string')
    assert.equal(baseType('DateTime | null'), 'DateTime')
  })
})

test.group('Generator / enum checks', () => {
  test("reads Postgres's and SQLite's CHECK constraints", ({ assert }) => {
    const enums = checkEnums([
      "CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text])))",
      "`kind` in ('percent', 'fixed', 'free_shipping')",
    ])
    assert.deepEqual(enums.get('status'), ['draft', 'published'])
    assert.deepEqual(enums.get('kind'), ['percent', 'fixed', 'free_shipping'])
  })
})

test.group('Generator / rendering', () => {
  test('the resource lists the title first and names the validators', ({ assert }) => {
    const source = renderResource(product, names, { validators: true })
    assert.include(
      source,
      "import { createProductValidator, updateProductValidator } from '#validators/product_admin'"
    )
    assert.include(source, "title: 'name',")
    assert.include(source, "search: ['name', 'sku'],")
    assert.match(
      source,
      /columns: \[\n {4}column\.text\('name'\)\.sortable\(\),\n {4}column\.belongsTo\('category', 'name'\),/
    )
    assert.include(source, "field.belongsTo('category').searchable('name'),")
    assert.include(
      source,
      "field.select('status').options({ draft: 'Draft', published: 'Published' }),"
    )
    // Long text stays off the list
    assert.notInclude(source, "column.text('description')")
    assert.include(source, "column.datetime('createdAt').sortable().hiddenByDefault(),")
  })

  test('the validator follows the columns (spec §7)', ({ assert }) => {
    const source = renderValidator(product, names)
    assert.include(
      source,
      "categoryId: vine.number().exists({ table: 'categories', column: 'id' }),"
    )
    assert.include(source, 'name: vine.string().trim().maxLength(160),')
    assert.include(
      source,
      "sku: vine.string().trim().maxLength(40).unique({ table: 'products', column: 'sku' }),"
    )
    assert.include(source, 'description: vine.string().trim().nullable().optional(),')
    assert.include(source, 'price: vine.string().trim().regex(/^-?\\d{1,10}(\\.\\d{1,2})?$/),')
    assert.include(source, 'stock: vine.number().withoutDecimals().optional(),')
    assert.include(source, "status: vine.enum(['draft', 'published'] as const).optional(),")
    // On update, the record's own value isn't taken
    assert.include(source, 'vine.withMetaData<{ record: Product }>().create({')
    assert.include(source, "query.whereNot('id', field.meta.record.id)")
  })

  test('without --validator, the resource names no validators', ({ assert }) => {
    const source = renderResource(product, names, { validators: false })
    assert.notInclude(source, 'validators:')
    assert.notInclude(source, '#validators/')
  })

  test('the policy allows admin users everything but delete', ({ assert }) => {
    const source = renderPolicy(product, names, { readonly: false })
    for (const method of ['viewList', 'view', 'create', 'update']) {
      assert.include(source, `  ${method}() {\n    return true\n  }`)
    }
    assert.notInclude(source, 'delete() {')
    assert.include(unwrap(source), 'deleting products is denied until you add one')
  })

  test('a required column with no field means no create', ({ assert }) => {
    const source = renderPolicy(
      plan(product.fields, { table: 'users', uncovered: ['password'] }),
      names,
      {
        readonly: false,
      }
    )
    assert.notInclude(source, 'create() {')
    assert.include(unwrap(source), 'users.password is required but not an admin field')
  })

  test('--readonly policies only list and view', ({ assert }) => {
    const source = renderPolicy(product, names, { readonly: true })
    assert.include(source, 'viewList() {')
    assert.include(source, 'view() {')
    assert.notInclude(source, 'create() {')
    assert.notInclude(source, 'update() {')
  })
})

test.group('Generator / planning', () => {
  test("boots the model before reading its table (a fresh app hasn't yet)", async ({
    assert,
    fs,
  }) => {
    await fs.create(
      'app/models/user.ts',
      'export default class User extends BaseModel {\n  declare email: string\n  declare password: string\n}'
    )
    // An unbooted Lucid model: `table` and the columns appear on boot()
    const model = {
      name: 'User',
      primaryKey: 'id',
      table: undefined as string | undefined,
      $columnsDefinitions: new Map(),
      $relationsDefinitions: new Map(),
      boot() {
        this.table = 'users'
        this.$columnsDefinitions = new Map([
          ['id', { columnName: 'id', isPrimary: true, serializeAs: 'id' }],
          ['email', { columnName: 'email', isPrimary: false, serializeAs: 'email' }],
          ['password', { columnName: 'password', isPrimary: false, serializeAs: null }],
        ])
      },
    }
    // A SQLite client that only knows the users table
    const client = {
      dialect: { name: 'better-sqlite3' },
      rawQuery: async (sql: string) =>
        sql === 'pragma table_info("users")'
          ? [
              { name: 'id', type: 'integer', notnull: 1, dflt_value: null },
              { name: 'email', type: 'varchar(254)', notnull: 1, dflt_value: null },
              { name: 'password', type: 'varchar(255)', notnull: 1, dflt_value: null },
            ]
          : [],
    }

    const planned = await planModel(model as unknown as LucidModel, client as never, {
      modelFile: () => `${fs.basePath}/app/models/user.ts`,
      schemaFile: `${fs.basePath}/database/schema.ts`,
    })
    assert.deepEqual(
      planned.fields.map((item) => [item.name, item.kind]),
      [['email', 'text']]
    )
    assert.deepEqual(planned.uncovered, ['password'])
  })
})

test.group('Generator: manyToMany (FR-09)', () => {
  const tags = {
    name: 'tags',
    input: 'tagIds',
    relatedTable: 'tags',
    relatedKeyColumn: 'id',
    integerKey: true,
    title: 'name',
  }

  test('emits a picker field and an array of existing keys', ({ assert }) => {
    const withTags = plan([], { manyToMany: [tags] })
    assert.include(
      renderResource(withTags, names, { validators: true }),
      "    field.manyToMany('tags').searchable('name'),"
    )
    const validator = renderValidator(withTags, names)
    const rule =
      "  tagIds: vine.array(vine.number().exists({ table: 'tags', column: 'id' })).optional(),"
    // In both the create and the update validator
    assert.equal(validator.split(rule).length - 1, 2)
  })

  test('string keys get a string rule, and no title means no searchable()', ({ assert }) => {
    const withLabels = plan([], {
      manyToMany: [
        {
          ...tags,
          name: 'labels',
          input: 'labelIds',
          relatedTable: 'labels',
          integerKey: false,
          title: null,
        },
      ],
    })
    assert.include(
      renderResource(withLabels, names, { validators: true }),
      "    field.manyToMany('labels'),"
    )
    assert.include(
      renderValidator(withLabels, names),
      "  labelIds: vine.array(vine.string().exists({ table: 'labels', column: 'id' })).optional(),"
    )
  })
})
