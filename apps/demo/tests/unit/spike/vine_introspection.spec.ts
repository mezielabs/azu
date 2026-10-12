/**
 * SPIKE (Phase 0, risk check 2). Throwaway.
 *
 * Runs inside the booted demo app because the product validators use
 * Lucid's `unique` and `exists` rules, which Lucid registers at boot.
 */
import { test } from '@japa/runner'
import vine from '@vinejs/vine'
import { errors } from '@vinejs/vine'
import { introspectValidator } from '@mezielabs/azu/spike'
import { createProductValidator } from '#validators/product'

test.group('Spike / VineJS introspection', () => {
  test('reads form hints from the demo product validator', ({ assert }) => {
    const hints = Object.fromEntries(
      introspectValidator(createProductValidator).map((h) => [h.path, h])
    )

    assert.containsSubset(hints.name, {
      kind: 'string',
      required: true,
      minLength: 2,
      maxLength: 160,
    })
    assert.containsSubset(hints.description, { kind: 'string', required: false, nullable: true })
    assert.containsSubset(hints.price, {
      kind: 'number',
      required: true,
      min: 0,
      max: 1_000_000,
      step: 0.01,
    })
    assert.containsSubset(hints.stock, { kind: 'number', integer: true, step: 1, min: 0 })
    assert.containsSubset(hints.status, {
      kind: 'enum',
      required: true,
      choices: ['draft', 'published'],
    })
    assert.containsSubset(hints.isFeatured, { kind: 'boolean', required: false })
    assert.containsSubset(hints.categoryId, { kind: 'number', required: true })
    assert.containsSubset(hints.sku, {
      kind: 'string',
      required: true,
      maxLength: 40,
      pattern: '^[A-Z0-9-]+$',
    })
    assert.containsSubset(hints.tags, { kind: 'array', required: false, maxItems: 10 })
    assert.containsSubset(hints['tags.*'], { kind: 'number' })

    // JSON Schema alone reports this field as `{ "type": "null" }`
    assert.containsSubset(hints.publishedAt, { kind: 'date', required: false, nullable: true })
  })

  test('handles nested objects, arrays of objects, and conditional rules', ({ assert }) => {
    const validator = vine.create({
      address: vine.object({ line1: vine.string().maxLength(80), city: vine.string().optional() }),
      variants: vine
        .array(vine.object({ sku: vine.string().maxLength(20), qty: vine.number().min(1) }))
        .minLength(1),
      kind: vine.enum(['physical', 'digital']),
      weight: vine.number().optional().requiredWhen('kind', '=', 'physical'),
    })
    const hints = Object.fromEntries(introspectValidator(validator).map((h) => [h.path, h]))

    assert.containsSubset(hints['address.line1'], { required: true, maxLength: 80 })
    assert.containsSubset(hints['address.city'], { required: false })
    assert.containsSubset(hints.variants, { kind: 'array', minItems: 1 })
    assert.containsSubset(hints['variants.*.sku'], { required: true, maxLength: 20 })
    assert.containsSubset(hints['variants.*.qty'], { min: 1 })
    // Required only sometimes: the form can't know, the server enforces it
    assert.containsSubset(hints.weight, { required: false, conditional: true })
  })

  test('error paths for nested and array fields match the hint paths', async ({ assert }) => {
    const validator = vine.create({
      variants: vine.array(vine.object({ sku: vine.string().maxLength(3) })),
    })
    try {
      await validator.validate({ variants: [{ sku: 'ok' }, { sku: 'too-long' }] })
      assert.fail('expected a validation error')
    } catch (error) {
      assert.instanceOf(error, errors.E_VALIDATION_ERROR)
      assert.deepEqual(
        (error as InstanceType<typeof errors.E_VALIDATION_ERROR>).messages.map((m: any) => m.field),
        ['variants.1.sku']
      )
    }
  })

  test('the compiled tree exposes the top-level keys, for checking fields against the validator', ({
    assert,
  }) => {
    const top = introspectValidator(createProductValidator)
      .map((h) => h.path)
      .filter((path) => !path.includes('.'))
    assert.sameMembers(top, [
      'name',
      'description',
      'price',
      'stock',
      'status',
      'isFeatured',
      'categoryId',
      'publishedAt',
      'tags',
      'sku',
    ])
  })
})
