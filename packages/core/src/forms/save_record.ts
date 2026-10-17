import type { HttpContext } from '@adonisjs/core/http'
import { generators } from '@adonisjs/core/app'
import { RuntimeException } from '@adonisjs/core/exceptions'
import type { LucidModel, LucidRow } from '@adonisjs/lucid/types/model'
import type { Resource } from '../resources/define_resource.ts'
import type { FormErrors, FormFieldSchema } from '../schema.ts'
import { processTimezone } from '../define_config.ts'
import { sanitizeRichText } from '../files/sanitize_html.ts'
import { FILE_KINDS, deleteFiles, diskFor, planUploads, storeUploads } from '../files/uploads.ts'
import { MANY_TO_MANY_LIMIT, manyToManyCount, manyToManyIds } from '../records/relations.ts'
import { EMPTY_RELATION_IDS } from '../shared/relation_options.ts'
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
 * A record's current value for a field, as the form would submit it:
 * dates as `YYYY-MM-DD`, datetimes as `vine.date()` reads them, and
 * decimals as strings (SQLite returns numbers).
 */
function currentInput(
  record: LucidRow,
  field: FormFieldSchema,
  timezones: { admin: string; process: string }
): unknown {
  const value = (record as unknown as Record<string, unknown>)[field.input]
  if (value === null || value === undefined) return value
  const date = value as { toISO?: () => string | null; toISODate?: () => string | null }
  if (typeof date.toISO === 'function') {
    return field.kind === 'date' ? date.toISODate!() : toValidatorDateTime(date.toISO(), timezones)
  }
  return field.kind === 'decimal' ? String(value) : value
}

/**
 * Why a save can't happen without a validator, and the two ways to fix
 * it: name an existing validator on the resource, or generate one with
 * AdonisJS's `make:validator` (names as its `--resource` stub writes
 * them).
 */
export function missingValidatorMessage(resource: Resource<any, any>, mode: FormMode): string {
  const model = resource.model.name
  const action = mode === 'create' ? 'create' : 'update'
  const validator = generators.validatorActionName(model, action)
  const file = generators.validatorFileName(model).replace(/\.ts$/, '')
  const option =
    mode === 'create'
      ? `validators: { create: ${validator} }`
      : `validators: { update: ${validator} } (or a create validator, which update falls back to)`

  return [
    `Azu can't ${action} ${model} records: the "${resource.name}" resource has no ${action} validator, ` +
      'and Azu only saves input that has been through one of your VineJS validators.',
    'Fix it in either of two ways:',
    `  - Name an existing validator in the resource: ${option}`,
    `  - Generate one, then name it in the resource: node ace make:validator ${file} --resource`,
  ].join('\n')
}

/**
 * Validates a create or update request and writes it (FR-06, FR-10).
 *
 * 1. The payload is limited to the fields the form showed this user,
 *    minus read-only ones, before validation. On edit, read-only fields
 *    get the record's current values, so a validator that requires them
 *    still passes.
 * 2. Datetimes become what `vine.date()` parses by default (see
 *    `toValidatorDateTime`). Then the payload goes through the
 *    resource's validator, with `validators.meta` (default `{ record }`)
 *    as VineJS metadata.
 * 3. Only the validator's output is written, again limited to those
 *    fields, never the raw payload. Hooks, the save and `manyToMany`
 *    pivot syncs share a transaction. A `manyToMany` key list the
 *    validator outputs replaces the attached records; one it leaves out
 *    changes nothing. A read-only `manyToMany` field is never synced,
 *    including one with more records attached than the form loads; its
 *    keys reach the validator only up to that limit.
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
    /** `defaultDisk` from config/admin.ts */
    defaultDisk?: string
  } = {}
): Promise<{ record: LucidRow; errors?: never } | { errors: FormErrors; record?: never }> {
  const validator = validatorFor(resource, mode)
  if (!validator) {
    throw new RuntimeException(missingValidatorMessage(resource, mode))
  }

  const { record } = options
  const writable = fields.filter((field) => !field.readOnly)
  const data = pick(
    ctx.request.body(),
    writable.map((field) => field.input)
  )

  const timezones = { admin: options.timezone ?? processTimezone(), process: processTimezone() }
  for (const field of writable) {
    if (!Object.hasOwn(data, field.input)) continue
    const value = data[field.input]
    if (field.kind === 'manyToMany' && value === EMPTY_RELATION_IDS) data[field.input] = []
    if (field.kind === 'datetime') data[field.input] = toValidatorDateTime(value, timezones)
    // The validator sees sanitised HTML, so its length rules apply to what's stored
    if (field.kind === 'richText' && typeof value === 'string') {
      data[field.input] = sanitizeRichText(value)
    }
  }

  // Uploads are checked (size, type from the bytes) and given keys, but
  // only stored once the record saves
  const hasFiles = writable.some((field) => FILE_KINDS.has(field.kind))
  const files = hasFiles
    ? await planUploads(ctx, resource, writable, options.defaultDisk)
    : { uploads: [], unchanged: [], errors: {} }
  for (const planned of files.uploads) data[planned.field.input] = planned.key
  // Sent with no file: a removal, whatever the body parser made of it
  const uploaded = new Set(files.uploads.map((planned) => planned.field.input))
  for (const field of writable) {
    const input = field.input
    if (FILE_KINDS.has(field.kind) && Object.hasOwn(data, input) && !uploaded.has(input)) {
      data[input] = null
    }
  }

  // Read-only fields, and files the request left alone, aren't written,
  // but the validator still sees the whole record: on edit they carry
  // its current values, from the record, never the request
  const kept = new Set(files.unchanged.map((field) => field.input))
  if (record) {
    for (const field of fields) {
      const failedUpload = Object.hasOwn(files.errors, field.input)
      if (field.kind === 'manyToMany' && field.readOnly) {
        // Past what the form loads, the keys stay out of validation too,
        // so a limit meant for the form (a maxLength) can't block the save
        if ((await manyToManyCount(record, field.name)) <= MANY_TO_MANY_LIMIT) {
          data[field.input] = await manyToManyIds(resource.model, record, field.name)
        }
      } else if (field.readOnly || kept.has(field.input) || failedUpload) {
        data[field.input] = currentInput(record, field, timezones)
      }
    }
  }
  const meta = resource.options.validators?.meta?.({ record, ctx }) ?? { record }

  let output: Record<string, unknown> = {}
  let errors: FormErrors = {}
  try {
    output = await validator.validate(data, { meta })
  } catch (error) {
    const messages = validationMessages(error)
    if (!messages) throw error
    errors = toFormErrors(messages)
  }
  // Upload problems come first under their field; the validator's follow
  for (const [path, messages] of Object.entries(files.errors)) {
    errors[path] = [...messages, ...(errors[path] ?? [])]
  }
  if (Object.keys(errors).length > 0) return { errors }

  // manyToMany keys sync pivot rows after the save; they aren't attributes
  const pivots = writable.filter(
    (field) => field.kind === 'manyToMany' && Array.isArray(output[field.input])
  )
  const names = writable
    .filter((field) => field.kind !== 'manyToMany')
    .map((field) => field.input)
    .filter((name) => !kept.has(name))
  const model: LucidModel = resource.model
  const target = record ?? new model()
  // Files this save replaces or removes, deleted once it commits
  const replaced = writable
    .filter((field) => FILE_KINDS.has(field.kind) && !kept.has(field.input) && record)
    .map((field) => ({
      key: (record as unknown as Record<string, unknown>)[field.input],
      disk: diskFor(field, options.defaultDisk),
    }))
    .filter(
      (file): file is { key: string; disk: string | undefined } =>
        typeof file.key === 'string' && file.key !== ''
    )

  const stored = await storeUploads(ctx, files.uploads)
  try {
    await model.transaction(async (trx) => {
      target.useTransaction(trx)
      target.merge(toAttributes(model, pick(output, names), target))
      await resource.options.beforeSave?.(target, ctx)
      await target.save()
      // In the same transaction: a failure rolls the record back too
      for (const field of pivots) {
        const ids = [...new Set(output[field.input] as (string | number)[])]
        await (
          target as unknown as {
            related(name: string): {
              sync(ids: unknown[], detach: boolean, trx: unknown): Promise<void>
            }
          }
        )
          .related(field.name)
          .sync(ids, true, trx)
      }
      await resource.options.afterSave?.(target, ctx)
    })
  } catch (error) {
    await stored.rollback()
    throw error
  }

  const stillUsed = new Set(
    names.map((name) => (target as unknown as Record<string, unknown>)[name])
  )
  await deleteFiles(
    ctx,
    replaced.filter((file) => !stillUsed.has(file.key))
  )

  return { record: target }
}
