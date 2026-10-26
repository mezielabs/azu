import type { FieldKind, FormFieldSchema } from '../schema.ts'

/**
 * Kinds whose input is short whatever the value: a number, a date, a
 * picker, a switch, a few radios.
 */
const SHORT_KINDS: ReadonlySet<FieldKind> = new Set([
  'number',
  'decimal',
  'date',
  'datetime',
  'select',
  'boolean',
  'belongsTo',
])

/**
 * Text fields up to this many characters (from the validator's
 * `maxLength`) are short, like a SKU; longer or unbounded ones, like a
 * name, take the whole row.
 */
export const SHORT_TEXT_LENGTH = 80

/**
 * How much of a form row a field takes. On a wide form, `half` fields
 * sit side by side in pairs, in their declared order; `full` fields
 * take the row. A field with its own component is sized by its kind.
 */
export function fieldWidth(field: Pick<FormFieldSchema, 'kind' | 'maxLength'>): 'half' | 'full' {
  if (SHORT_KINDS.has(field.kind)) return 'half'
  if (field.kind === 'text') {
    return field.maxLength !== null && field.maxLength <= SHORT_TEXT_LENGTH ? 'half' : 'full'
  }
  return 'full'
}

/**
 * The save bar's status: `Unsaved changes`, `2 fields need attention`,
 * both, or `null` for a clean, valid form.
 */
export function formStatus(state: { dirty: boolean; invalid: number }): string | null {
  const parts: string[] = []
  if (state.dirty) parts.push('Unsaved changes')
  if (state.invalid > 0) {
    parts.push(
      state.invalid === 1 ? '1 field needs attention' : `${state.invalid} fields need attention`
    )
  }
  return parts.length > 0 ? parts.join(' · ') : null
}

/** Group visible form fields by heading in first-appearance order, preserving field order within each group. */
export function formSections<T extends { section?: string | null }>(fields: readonly T[]) {
  const groups = new Map<string | null, T[]>()
  for (const field of fields) {
    const heading = field.section?.trim() || null
    const group = groups.get(heading)
    if (group) group.push(field)
    else groups.set(heading, [field])
  }
  return [...groups].map(([heading, items]) => ({ heading, fields: items }))
}
