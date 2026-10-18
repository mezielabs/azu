import { test } from '@japa/runner'
import vine from '@vinejs/vine'
import { withCurrency, withHints } from '../src/forms/form_fields.ts'
import { introspectValidator } from '../src/forms/introspect.ts'
import { toFormErrors } from '../src/forms/save_record.ts'
import { column } from '../src/resources/columns.ts'
import { field } from '../src/resources/fields.ts'
import { fieldErrors, unmatchedErrors } from '../shared.ts'

/**
 * A contract test for VineJS's `toJSON()` and `toJSONSchema()` shapes:
 * if a VineJS upgrade changes either, this fails (spike-findings §2).
 */
test.group('VineJS introspection', () => {
  const validator = vine.create({
    name: vine.string().minLength(2).maxLength(160),
    price: vine.number().min(0).max(1000).decimal([0, 2]),
    stock: vine.number().withoutDecimals().min(0),
    status: vine.enum(['draft', 'published']),
    notes: vine.string().nullable(),
    summary: vine.string().optional(),
    publishedAt: vine.date().optional(),
    isFeatured: vine.boolean(),
    sku: vine.string().optional().requiredWhen('status', '=', 'published'),
    dimensions: vine.object({ width: vine.number().min(1) }),
    tags: vine.array(vine.number()).maxLength(10),
  })
  const hints = introspectValidator(validator)

  test('reads required and lengths', ({ assert }) => {
    assert.containsSubset(hints.get('name'), {
      kind: 'string',
      required: true,
      minLength: 2,
      maxLength: 160,
    })
  })

  test('reads bounds and steps', ({ assert }) => {
    assert.containsSubset(hints.get('price'), { required: true, min: 0, max: 1000, step: 0.01 })
    assert.containsSubset(hints.get('stock'), { min: 0, step: 1 })
  })

  test('reads enum choices', ({ assert }) => {
    assert.containsSubset(hints.get('status'), {
      kind: 'enum',
      choices: ['draft', 'published'],
    })
  })

  test('nullable and optional fields are not required', ({ assert }) => {
    assert.containsSubset(hints.get('notes'), { required: false, nullable: true })
    assert.containsSubset(hints.get('summary'), { required: false, nullable: false })
  })

  test('reads dates and booleans from the compiled nodes', ({ assert }) => {
    assert.containsSubset(hints.get('publishedAt'), { kind: 'date', required: false })
    assert.containsSubset(hints.get('isFeatured'), { kind: 'boolean', required: true })
  })

  test('conditional rules show as optional', ({ assert }) => {
    assert.containsSubset(hints.get('sku'), { required: false, conditional: true })
  })

  test('nested and array paths line up with error paths', ({ assert }) => {
    assert.containsSubset(hints.get('dimensions.width'), { required: true, min: 1 })
    assert.containsSubset(hints.get('tags'), { maxItems: 10 })
    assert.containsSubset(hints.get('tags.*'), { kind: 'number' })
  })

  test('caches per validator', ({ assert }) => {
    assert.strictEqual(introspectValidator(validator), hints)
  })
})

test.group('Form field hints', () => {
  const hints = introspectValidator(
    vine.create({
      price: vine.number().min(5).max(100).decimal([0, 2]),
      status: vine.enum(['draft', 'published']),
    })
  )

  test('explicit field hints override the validator, for the UI only', ({ assert }) => {
    const price = withHints(field.decimal('price').min('0.00').toJSON(), hints.get('price'))
    assert.containsSubset(price, { min: '0.00', max: 100, step: 0.01, required: true })
  })

  test('a select without options takes the enum choices', ({ assert }) => {
    const status = withHints(field.select('status').toJSON(), hints.get('status'))
    assert.deepEqual(status.options, { draft: 'draft', published: 'published' })

    const labelled = withHints(
      field.select('status').options({ draft: 'Draft' }).toJSON(),
      hints.get('status')
    )
    assert.deepEqual(labelled.options, { draft: 'Draft' })
  })

  test('a number or decimal field borrows its currency column as its prefix', ({ assert }) => {
    const columns = [
      column.decimal('price').format('currency', 'NGN').toJSON(),
      column.decimal('rate').format('percent').toJSON(),
      column.number('stock').toJSON(),
    ]
    const form = (built: { toJSON(): Parameters<typeof withHints>[0] }) =>
      withCurrency(withHints(built.toJSON(), undefined), columns).prefix

    assert.equal(form(field.decimal('price')), 'NGN')
    assert.isNull(form(field.decimal('rate')))
    assert.isNull(form(field.number('stock')))
    assert.isNull(form(field.decimal('discount')))
    // Only numbers: a text field of the same name keeps its own
    assert.isNull(form(field.text('price')))
    assert.equal(form(field.text('price').prefix('#')), '#')
  })

  test('a field the validator does not know is optional, with no hints', ({ assert }) => {
    assert.containsSubset(withHints(field.text('notes').toJSON(), undefined), {
      required: false,
      minLength: null,
      maxLength: null,
      min: null,
    })
  })
})

test.group('Form errors', () => {
  test('groups VineJS messages by path', ({ assert }) => {
    const errors = toFormErrors([
      { field: 'name', message: 'Too short' },
      { field: 'name', message: 'Not unique' },
      { field: 'tags.0', message: 'Must be a number' },
    ])
    assert.deepEqual(errors, {
      'name': ['Too short', 'Not unique'],
      'tags.0': ['Must be a number'],
    })
  })

  test('nested and array paths render under their field', ({ assert }) => {
    const errors = {
      'tags.0': ['First tag'],
      'tags.2': ['Third tag'],
      'tagline': ['Not a tag'],
      'variants.1.sku': ['Variant SKU'],
    }
    assert.deepEqual(fieldErrors(errors, 'tags'), ['First tag', 'Third tag'])
    assert.deepEqual(fieldErrors(errors, 'variants'), ['Variant SKU'])
    assert.deepEqual(fieldErrors(errors, 'tagline'), ['Not a tag'])
  })

  test('errors no shown field covers are kept for the form summary', ({ assert }) => {
    const errors = { name: ['Name'], categoryId: ['Pick a category'] }
    assert.deepEqual(unmatchedErrors(errors, ['name']), ['Pick a category'])
  })
})
