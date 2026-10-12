/**
 * SPIKE (Phase 0, risk check 2). Throwaway. The demo app runs the same
 * prototype against its real validators in tests/unit/spike.
 */
import { test } from '@japa/runner'
import vine from '@vinejs/vine'
import { introspectValidator } from '../spike/vine_introspection.ts'

test.group('Spike / introspectValidator', () => {
  test('reads required, lengths, bounds, step, and choices', ({ assert }) => {
    const validator = vine.create({
      name: vine.string().minLength(2).maxLength(160),
      price: vine.number().min(0).decimal([0, 2]),
      status: vine.enum(['draft', 'published']),
      notes: vine.string().nullable(),
      publishedAt: vine.date().optional(),
    })

    const hints = Object.fromEntries(introspectValidator(validator).map((h) => [h.path, h]))

    assert.containsSubset(hints.name, { required: true, minLength: 2, maxLength: 160 })
    assert.containsSubset(hints.price, { required: true, min: 0, step: 0.01 })
    assert.containsSubset(hints.status, { kind: 'enum', choices: ['draft', 'published'] })
    assert.containsSubset(hints.notes, { required: false, nullable: true })
    assert.containsSubset(hints.publishedAt, { kind: 'date', required: false })
  })
})
