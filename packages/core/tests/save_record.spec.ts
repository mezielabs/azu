import { test } from '@japa/runner'
import type { HttpContext } from '@adonisjs/core/http'
import type { LucidModel } from '@adonisjs/lucid/types/model'
import { formFields } from '../src/forms/form_fields.ts'
import { missingValidatorMessage, saveRecord } from '../src/forms/save_record.ts'
import { defineResource } from '../src/resources/define_resource.ts'
import { field } from '../src/resources/fields.ts'

class ProductPolicy {
  create() {}
  update() {}
  editPrice() {}
}

/**
 * A stand-in Lucid model that records what was written, and in what
 * order hooks and the save ran.
 */
function fakeModel() {
  const events: string[] = []
  class Row {
    attributes: Record<string, unknown> = {}
    $primaryKeyValue = 1
    useTransaction() {
      events.push('transaction')
    }
    merge(values: Record<string, unknown>) {
      Object.assign(this.attributes, values)
    }
    async save() {
      events.push('save')
    }
  }
  const model = Object.assign(Row, {
    $getColumn: () => undefined,
    transaction: async (callback: (trx: unknown) => Promise<void>) => callback({}),
  })
  return { model: model as unknown as LucidModel, events }
}

/**
 * A request with a JSON body, whose Bouncer allows the listed abilities.
 */
function request(body: Record<string, unknown>, allowed: string[] = ['create', 'update']) {
  return {
    request: { body: () => body },
    logger: { warn() {} },
    bouncer: {
      with: () => ({ allows: async (ability: string) => allowed.includes(ability) }),
    },
  } as unknown as HttpContext
}

/**
 * A validator that records its input and metadata, and outputs what
 * `output` returns.
 */
function fakeValidator(output: (data: any) => Record<string, unknown> = (data) => data) {
  const calls: { data: any; meta: any }[] = []
  return {
    calls,
    validate: async (data: any, options?: { meta?: any }) => {
      calls.push({ data, meta: options?.meta })
      return output(data)
    },
  }
}

test.group('Form fields', () => {
  const { model } = fakeModel()
  const resource = defineResource(model, {
    policy: ProductPolicy,
    fields: [
      field.text('name'),
      field.text('sku').visibleOn('create'),
      field.text('slug').visibleOn('edit'),
      field.decimal('price').ability('editPrice'),
      field.richText('description'),
    ],
  } as never)

  test('visibleOn picks the form', async ({ assert }) => {
    const create = await formFields(request({}, ['editPrice']), resource, 'create')
    const edit = await formFields(request({}, ['editPrice']), resource, 'edit', {} as never)
    assert.deepEqual(
      create.map((item) => item.name),
      ['name', 'sku', 'price']
    )
    assert.deepEqual(
      edit.map((item) => item.name),
      ['name', 'slug', 'price']
    )
  })

  test("a field's ability hides it unless the policy allows it", async ({ assert }) => {
    const fields = await formFields(request({}, []), resource, 'create')
    assert.notInclude(
      fields.map((item) => item.name),
      'price'
    )
  })

  test('kinds that arrive with FR-07 and FR-08 are left out', async ({ assert }) => {
    const fields = await formFields(request({}, ['editPrice']), resource, 'create')
    assert.notInclude(
      fields.map((item) => item.name),
      'description'
    )
  })
})

test.group('Saving a record', () => {
  test('passes only declared, writable fields to the validator, with { record }', async ({
    assert,
  }) => {
    const { model } = fakeModel()
    const validator = fakeValidator()
    const resource = defineResource(model, {
      policy: ProductPolicy,
      validators: { create: validator },
      fields: [field.text('name'), field.text('sku').readOnly()],
    } as never)
    const ctx = request({ name: 'Pot', sku: 'POT-1', id: 99, role: 'admin' })

    await saveRecord(ctx, resource, 'create', await formFields(ctx, resource, 'create'))

    assert.deepEqual(validator.calls[0].data, { name: 'Pot' })
    assert.deepEqual(validator.calls[0].meta, { record: undefined })
  })

  test("writes the validator's output, not the raw payload", async ({ assert }) => {
    const { model } = fakeModel()
    const validator = fakeValidator((data) => ({ name: data.name.trim().toUpperCase(), extra: 1 }))
    const resource = defineResource(model, {
      policy: ProductPolicy,
      validators: { create: validator },
      fields: [field.text('name')],
    } as never)
    const ctx = request({ name: '  pot ' })

    const result = await saveRecord(
      ctx,
      resource,
      'create',
      await formFields(ctx, resource, 'create')
    )

    // `extra` isn't a declared field, so it isn't written either
    assert.deepEqual((result.record as any).attributes, { name: 'POT' })
  })

  test('update uses the update validator and maps metadata', async ({ assert }) => {
    const { model } = fakeModel()
    const create = fakeValidator()
    const update = fakeValidator()
    const record = new (model as any)()
    const resource = defineResource(model, {
      policy: ProductPolicy,
      validators: { create, update, meta: ({ record: row }: any) => ({ productId: row?.id }) },
      fields: [field.text('name')],
    } as never)
    record.id = 7
    const ctx = request({ name: 'Pan' })

    await saveRecord(ctx, resource, 'edit', await formFields(ctx, resource, 'edit', record), {
      record,
    })

    assert.lengthOf(create.calls, 0)
    assert.deepEqual(update.calls[0].meta, { productId: 7 })
  })

  test("on edit, read-only fields carry the record's values, never the request's", async ({
    assert,
  }) => {
    const { model } = fakeModel()
    const update = fakeValidator()
    const record = new (model as any)()
    record.categoryId = 4
    const resource = defineResource(model, {
      policy: ProductPolicy,
      validators: { update },
      fields: [field.text('name'), field.text('categoryId').readOnly()],
    } as never)
    const ctx = request({ name: 'Pan', categoryId: 9 })

    const result = await saveRecord(
      ctx,
      resource,
      'edit',
      await formFields(ctx, resource, 'edit', record),
      { record }
    )

    assert.deepEqual(update.calls[0].data, { name: 'Pan', categoryId: 4 })
    // And it isn't written
    assert.deepEqual((result.record as any).attributes, { name: 'Pan' })
  })

  test('update falls back to the create validator', async ({ assert }) => {
    const { model } = fakeModel()
    const create = fakeValidator()
    const resource = defineResource(model, {
      policy: ProductPolicy,
      validators: { create },
      fields: [field.text('name')],
    } as never)
    const ctx = request({ name: 'Pan' })
    const record = new (model as any)()

    await saveRecord(ctx, resource, 'edit', await formFields(ctx, resource, 'edit', record), {
      record,
    })

    assert.lengthOf(create.calls, 1)
  })

  test('validation errors come back keyed by path, and nothing is saved', async ({ assert }) => {
    const { model, events } = fakeModel()
    const resource = defineResource(model, {
      policy: ProductPolicy,
      validators: {
        create: {
          validate: async () => {
            throw Object.assign(new Error('Validation failure'), {
              code: 'E_VALIDATION_ERROR',
              messages: [{ field: 'tags.0', message: 'Must be a number', rule: 'number' }],
            })
          },
        },
      },
      fields: [field.text('name')],
    } as never)
    const ctx = request({ name: 'Pot' })

    const result = await saveRecord(
      ctx,
      resource,
      'create',
      await formFields(ctx, resource, 'create')
    )

    assert.deepEqual(result.errors, { 'tags.0': ['Must be a number'] })
    assert.deepEqual(events, [])
  })

  test('hooks and the save share a transaction', async ({ assert }) => {
    const { model, events } = fakeModel()
    const resource = defineResource(model, {
      policy: ProductPolicy,
      validators: { create: fakeValidator() },
      fields: [field.text('name')],
      beforeSave: () => events.push('beforeSave'),
      afterSave: () => events.push('afterSave'),
    } as never)
    const ctx = request({ name: 'Pot' })

    await saveRecord(ctx, resource, 'create', await formFields(ctx, resource, 'create'))

    assert.deepEqual(events, ['transaction', 'beforeSave', 'save', 'afterSave'])
  })

  test('a resource without a validator cannot write', async ({ assert }) => {
    const { model } = fakeModel()
    const resource = defineResource(model, {
      policy: ProductPolicy,
      fields: [field.text('name')],
    } as never)
    const ctx = request({ name: 'Pot' })

    await assert.rejects(() => saveRecord(ctx, resource, 'create', []), /has no create validator/)
  })

  test('the error names the resource and operation, and both fixes', ({ assert }) => {
    const resource = defineResource(
      { name: 'OrderItem' } as unknown as LucidModel,
      {
        policy: ProductPolicy,
      } as never
    )

    assert.equal(
      missingValidatorMessage(resource, 'create'),
      [
        'Azu can\'t create OrderItem records: the "order-items" resource has no create validator, and Azu only saves input that has been through one of your VineJS validators.',
        'Fix it in either of two ways:',
        '  - Name an existing validator in the resource: validators: { create: createOrderItemValidator }',
        '  - Generate one, then name it in the resource: node ace make:validator order_item --resource',
      ].join('\n')
    )
    assert.include(
      missingValidatorMessage(resource, 'edit'),
      'can\'t update OrderItem records: the "order-items" resource has no update validator'
    )
    assert.include(
      missingValidatorMessage(resource, 'edit'),
      'validators: { update: updateOrderItemValidator } (or a create validator, which update falls back to)'
    )
  })
})
