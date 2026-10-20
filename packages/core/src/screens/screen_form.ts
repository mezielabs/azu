import type { HttpContext } from '@adonisjs/core/http'
import type { LucidRow } from '@adonisjs/lucid/types/model'
import { formValues, withHints } from '../forms/form_fields.ts'
import { introspectValidator, isIntrospectable } from '../forms/introspect.ts'
import { currentInput, formTimezones, readFieldInput, validateInput } from '../forms/save_record.ts'
import type { FormErrors, FormFieldSchema } from '../schema.ts'
import type { ScreenFormData } from '../types.ts'
import type { Screen, ScreenForm } from './define_screen.ts'

/**
 * A screen form's fields (FR-23), with hints from its validator:
 * required markers, lengths, limits, a select's choices.
 */
export function screenFormFields(form: ScreenForm<any>): FormFieldSchema[] {
  const hints = isIntrospectable(form.validator) ? introspectValidator(form.validator) : new Map()
  return form.fields.map((item) => {
    const field = item.toJSON()
    return withHints(field, hints.get(field.name))
  })
}

/**
 * What a form screen's page shows: its fields and `load`'s values, as
 * the resource forms show a record's.
 */
export async function screenFormData(
  ctx: HttpContext,
  screen: Screen<any>,
  fields: FormFieldSchema[]
): Promise<ScreenFormData> {
  const form = screen.form!
  const values = (await form.load(ctx)) ?? {}
  return {
    fields,
    // load's object reads like a record: same values, same formatting
    values: formValues(fields, values as unknown as LucidRow),
    successMessage: form.successMessage ?? `${screen.options.label} saved`,
  }
}

/**
 * Saves a form screen (FR-23), the way a resource save works:
 *
 * 1. Only the declared, writable fields are read from the request
 *    (mass assignment), datetimes in the admin's timezone and rich text
 *    sanitised.
 * 2. Read-only fields reach the validator with `load`'s values, never
 *    the request's.
 * 3. `save` gets the validator's output for the writable fields, and
 *    nothing else.
 *
 * Returns the validation errors, if any.
 */
export async function saveScreenForm(
  ctx: HttpContext,
  screen: Screen<any>,
  fields: FormFieldSchema[],
  options: { timezone?: string } = {}
): Promise<{ errors: FormErrors } | { errors?: never }> {
  const form = screen.form!
  const timezones = formTimezones(options.timezone)
  const data = readFieldInput(ctx, fields, timezones)

  const readOnly = fields.filter((field) => field.readOnly)
  if (readOnly.length > 0) {
    const current = ((await form.load(ctx)) ?? {}) as Record<string, unknown>
    for (const field of readOnly) data[field.input] = currentInput(current, field, timezones)
  }

  const result = await validateInput(form.validator, data)
  if (result.errors) return { errors: result.errors }

  const writable = fields.filter((field) => !field.readOnly).map((field) => field.input)
  const input = Object.fromEntries(
    writable
      .filter((name) => Object.hasOwn(result.output, name))
      .map((name) => [name, result.output[name]])
  )
  await form.save(input as never, ctx)
  return {}
}
