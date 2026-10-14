import type { HttpContext } from '@adonisjs/core/http'
import { RuntimeException } from '@adonisjs/core/exceptions'
import type { LucidModel, LucidRow } from '@adonisjs/lucid/types/model'
import type { Resource } from '../resources/define_resource.ts'
import type { FormErrors, FormFieldSchema } from '../schema.ts'
import { processTimezone } from '../define_config.ts'
import { toValidatorDateTime } from './datetime_input.ts'
import { validatorFor, type FormMode } from './form_fields.ts'

type ValidationMessage = { field: string; message: string }

/**
 * VineJS's `E_VALIDATION_ERROR`, recognised by shape so a second copy
 * of VineJS in the app still matches.
 */
function validationMessages(error: unknown): ValidationMessage[] | null {
  const candidate = error as { code?: unknown; messages?: unknown } | null
  if (candidate?.code !== 'E_VALIDATION_ERROR' || !Array.isArray(candidate.messages)) return null
  return candidate.messages as ValidationMessage[]
}

/**
 * VineJS messages keyed by field path, in the order VineJS reported
 * them: `{ 'variants.1.sku': ['The sku field must be defined'] }`.
 */
export function toFormErrors(messages: ValidationMessage[]): FormErrors {
  const errors: FormErrors = {}
  for (const { field, message } of messages) {
    ;(errors[field] ??= []).push(message)
  }
  return errors
}

function pick(source: Record<string, unknown>, names: string[]) {
  return Object.fromEntries(
    names.filter((name) => Object.hasOwn(source, name)).map((name) => [name, source[name]])
  )
}

/**
 * Validator output for Lucid. A `vine.date()` without the app's Luxon
 * transform outputs a JS `Date`, which Lucid won't persist; the date
 * column's own `consume` turns it into a Luxon `DateTime`.
 */
function toAttributes(model: LucidModel, output: Record<string, unknown>, target: LucidRow) {
  return Object.fromEntries(
    Object.entries(output).map(([name, value]) => {
      const consume = model.$getColumn(name)?.consume
      return [name, value instanceof Date && consume ? consume(value, name, target) : value]
    })
  )
}

/**
 * Validates a create or update request and writes it (FR-06, FR-10).
 *
 * 1. The payload is limited to the fields the form showed this user,
 *    minus read-only ones, before validation.
 * 2. Datetimes become what `vine.date()` parses by default (see
 *    `toValidatorDateTime`). Then the payload goes through the
 *    resource's validator, with `validators.meta` (default `{ record }`)
 *    as VineJS metadata.
 * 3. Only the validator's output is written, again limited to those
 *    fields, never the raw payload. Hooks and the save share a
 *    transaction.
 *
 * Returns the saved record, or the validation errors.
 */
export async function saveRecord(
  ctx: HttpContext,
  resource: Resource<any, any>,
  mode: FormMode,
  fields: FormFieldSchema[],
  options: {
    /** The record being edited; none on create */
    record?: LucidRow
    /** The admin's timezone, which wall-clock datetimes are read in */
    timezone?: string
  } = {}
): Promise<{ record: LucidRow; errors?: never } | { errors: FormErrors; record?: never }> {
  const validator = validatorFor(resource, mode)
  if (!validator) {
    throw new RuntimeException(
      `Resource "${resource.name}" has no ${mode === 'create' ? 'create' : 'create or update'} validator. ` +
        'Azu writes only through the VineJS validators named in the resource\'s "validators" option.'
    )
  }

  const { record } = options
  const writable = fields.filter((field) => !field.readOnly)
  const names = writable.map((field) => field.name)
  const data = pick(ctx.request.body(), names)

  const timezones = { admin: options.timezone ?? processTimezone(), process: processTimezone() }
  for (const field of writable) {
    if (field.kind === 'datetime' && Object.hasOwn(data, field.name)) {
      data[field.name] = toValidatorDateTime(data[field.name], timezones)
    }
  }
  const meta = resource.options.validators?.meta?.({ record, ctx }) ?? { record }

  let output: Record<string, unknown>
  try {
    output = await validator.validate(data, { meta })
  } catch (error) {
    const messages = validationMessages(error)
    if (!messages) throw error
    return { errors: toFormErrors(messages) }
  }

  const model: LucidModel = resource.model
  const target = record ?? new model()
  await model.transaction(async (trx) => {
    target.useTransaction(trx)
    target.merge(toAttributes(model, pick(output, names), target))
    await resource.options.beforeSave?.(target, ctx)
    await target.save()
    await resource.options.afterSave?.(target, ctx)
  })

  return { record: target }
}
