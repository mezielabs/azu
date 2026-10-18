import string from '@adonisjs/core/helpers/string'
import type { HttpContext } from '@adonisjs/core/http'
import type { LucidRow } from '@adonisjs/lucid/types/model'
import { allows } from '../resources/abilities.ts'
import type { Resource, ValidatorLike } from '../resources/define_resource.ts'
import { DEFAULT_FILE_TYPES, DEFAULT_IMAGE_TYPES, DEFAULT_MAX_SIZE } from '../files/file_types.ts'
import { sanitizeRichText } from '../files/sanitize_html.ts'
import { relationKeys } from '../records/relations.ts'
import type {
  ColumnSchema,
  FieldKind,
  FieldSchema,
  FieldValue,
  FormFieldSchema,
  RecordData,
} from '../schema.ts'
import { introspectValidator, isIntrospectable, type FieldHints } from './introspect.ts'

export type FormMode = 'create' | 'edit'

/**
 * Field kinds the forms and detail page render. `hasMany` is a table
 * on the detail page, never a form field.
 */
export const FORM_KINDS: ReadonlySet<FieldKind> = new Set([
  'text',
  'textarea',
  'number',
  'decimal',
  'boolean',
  'select',
  'date',
  'datetime',
  'belongsTo',
  'manyToMany',
  'richText',
  'file',
  'image',
])

/**
 * The payload key a field submits and its errors use:
 *
 * - a `belongsTo` field writes its foreign key (`category` → `categoryId`)
 * - a `manyToMany` field sends the related records' keys, under the
 *   relation's singular name plus `Ids` (`tags` → `tagIds`,
 *   `relatedProducts` → `relatedProductIds`)
 */
export function inputName(resource: Resource<any, any>, field: FieldSchema): string {
  if (field.kind === 'manyToMany') return manyToManyInput(field.name)
  if (field.kind !== 'belongsTo') return field.name
  return relationKeys(resource.model, field.name)?.foreignKey ?? field.name
}

/** `tags` → `tagIds` */
export function manyToManyInput(relation: string): string {
  return `${string.camelCase(string.singular(relation))}Ids`
}

/**
 * The validator for an operation. Update falls back to the create
 * validator, as the README describes.
 */
export function validatorFor(resource: Resource<any, any>, mode: FormMode) {
  const validators = resource.options.validators
  return (mode === 'create' ? validators?.create : (validators?.update ?? validators?.create)) as
    ValidatorLike | undefined
}

/**
 * Whether the user passes a field's own `ability`, if it has one. On
 * edit and detail, the policy method receives the record.
 */
export function fieldAllowed(
  ctx: HttpContext,
  resource: Resource<any, any>,
  field: FieldSchema,
  record?: LucidRow
) {
  if (!field.ability) return true
  return record
    ? allows(ctx, resource, field.ability, record)
    : allows(ctx, resource, field.ability)
}

/**
 * The fields the detail page shows this user.
 */
export async function detailFields(
  ctx: HttpContext,
  resource: Resource<any, any>,
  record: LucidRow
): Promise<FieldSchema[]> {
  const fields: FieldSchema[] = []
  for (const field of resource.toSchema().fields) {
    if (FORM_KINDS.has(field.kind) && (await fieldAllowed(ctx, resource, field, record))) {
      fields.push(field)
    }
  }
  return fields
}

/**
 * Explicit hints win; the validator fills the gaps. A select without
 * options takes the validator's enum choices.
 */
export function withHints(
  field: FieldSchema,
  hints: FieldHints | undefined,
  input = field.name
): FormFieldSchema {
  return {
    ...field,
    input,
    optionsUrl: null,
    readOnlyReason: null,
    min: field.min ?? hints?.min ?? null,
    max: field.max ?? hints?.max ?? null,
    step: field.step ?? hints?.step ?? null,
    options:
      field.options ??
      (hints?.choices ? Object.fromEntries(hints.choices.map((value) => [value, value])) : null),
    // Uploads show the limits the server applies, defaults included
    ...(field.kind === 'file' || field.kind === 'image'
      ? {
          accept:
            field.accept ?? (field.kind === 'image' ? DEFAULT_IMAGE_TYPES : DEFAULT_FILE_TYPES),
          maxSize: field.maxSize ?? DEFAULT_MAX_SIZE[field.kind],
        }
      : {}),
    required: hints?.required ?? false,
    minLength: hints?.minLength ?? null,
    maxLength: hints?.maxLength ?? null,
  }
}

/**
 * The fields a create or edit form shows this user, with hints from
 * the operation's validator. A field is left out when it's for the
 * other form (`visibleOn`) or the user fails its `ability`.
 */
export async function formFields(
  ctx: HttpContext,
  resource: Resource<any, any>,
  mode: FormMode,
  record?: LucidRow
): Promise<FormFieldSchema[]> {
  const validator = validatorFor(resource, mode)
  const hints = isIntrospectable(validator) ? introspectValidator(validator) : new Map()

  const schema = resource.toSchema()
  const fields: FormFieldSchema[] = []
  for (const field of schema.fields) {
    if (!FORM_KINDS.has(field.kind)) continue
    if (field.visibleOn && field.visibleOn !== mode) continue
    if (!(await fieldAllowed(ctx, resource, field, record))) continue
    const input = inputName(resource, field)
    fields.push(withCurrency(withHints(field, hints.get(input), input), schema.columns))
  }
  return fields
}

/**
 * A number or decimal field without a prefix of its own borrows the
 * currency of the list column with the same name: `price`, shown as
 * `NGN 11,250.00`, is typed after an `NGN` prefix.
 */
export function withCurrency(
  field: FormFieldSchema,
  columns: Pick<ColumnSchema, 'name' | 'format'>[]
): FormFieldSchema {
  if ((field.kind !== 'number' && field.kind !== 'decimal') || field.prefix !== null) return field
  const format = columns.find((column) => column.name === field.name)?.format
  return format?.style === 'currency' && format.currency
    ? { ...field, prefix: format.currency }
    : field
}

type DateLike = { toISO(): string | null; toISODate(): string | null }

function isDateLike(value: unknown): value is DateLike {
  return typeof (value as DateLike | null)?.toISO === 'function'
}

/**
 * A plain value for a field: decimals stay exact strings, dates become
 * `YYYY-MM-DD`, datetimes ISO strings with an offset.
 */
export function fieldValue(record: LucidRow, field: FieldSchema): FieldValue {
  const value = (record as unknown as Record<string, unknown>)[field.name]
  if (value === null || value === undefined) return null

  switch (field.kind) {
    case 'date':
      return isDateLike(value) ? value.toISODate() : String(value)
    case 'datetime':
      return isDateLike(value) ? value.toISO() : String(value)
    case 'number':
      return typeof value === 'number' ? value : Number(value)
    case 'boolean':
      // MySQL and SQLite return 1 and 0
      return Boolean(value)
    case 'richText':
      // Again on the way out, so HTML written outside Azu is safe too
      return sanitizeRichText(String(value))
    default:
      return String(value)
  }
}

/**
 * The record's id, title and field values, for the detail page.
 */
export function recordData(
  resource: Resource<any, any>,
  record: LucidRow,
  fields: FieldSchema[],
  /** Values that need a query or Drive: relations and files */
  resolved: Record<string, FieldValue> = {}
): RecordData {
  const title = resource.options.title
    ? (record as unknown as Record<string, unknown>)[resource.options.title]
    : null
  return {
    id: record.$primaryKeyValue as string | number,
    title: title === null || title === undefined ? null : String(title),
    values: Object.fromEntries(
      fields.map((field) => [
        field.name,
        Object.hasOwn(resolved, field.name) ? resolved[field.name] : fieldValue(record, field),
      ])
    ),
  }
}

/**
 * A form's starting values: the record's on edit, field defaults on
 * create. A switch can't show "unset", so booleans start as `false`.
 */
export function formValues(
  fields: FormFieldSchema[],
  record?: LucidRow,
  /** Values that need a query or Drive: relations and files */
  resolved: Record<string, FieldValue> = {}
): Record<string, FieldValue> {
  return Object.fromEntries(
    fields.map((field) => {
      if (Object.hasOwn(resolved, field.name)) return [field.name, resolved[field.name]]
      const value = record ? fieldValue(record, field) : field.default
      return [field.name, field.kind === 'boolean' ? Boolean(value) : value]
    })
  )
}
