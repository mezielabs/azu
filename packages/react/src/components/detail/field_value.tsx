import { formatDateTime, formatDecimal, formatNumber } from '@mezielabs/azu/shared'
import { Link } from '@inertiajs/react'
import type { FieldSchema, FieldValue, RelationValue } from '@mezielabs/azu/types'

const EMPTY = <span className="azu-cell-empty">—</span>

/**
 * A field's value on the detail page, read-only. Formatting lives in
 * `@mezielabs/azu/shared` (non-negotiable 11); this only renders.
 */
export function FieldValueView(props: { field: FieldSchema; value: FieldValue; timezone: string }) {
  const { field, value, timezone } = props
  if (value === null || value === '') return EMPTY

  switch (field.kind) {
    case 'belongsTo': {
      const related = value as RelationValue
      const label = related.title ?? String(related.id)
      return related.href ? <Link href={related.href}>{label}</Link> : <>{label}</>
    }
    case 'number':
      return <>{formatNumber(value as number, null)}</>
    case 'decimal':
      return <>{formatDecimal(String(value), null)}</>
    case 'boolean':
      return <>{value ? 'Yes' : 'No'}</>
    case 'select':
      return <>{field.options?.[String(value)] ?? String(value)}</>
    case 'date':
      // `YYYY-MM-DD` has no zone: read it as UTC midnight and show it as such
      return (
        <time dateTime={String(value)}>
          {formatDateTime(String(value), { timezone: 'UTC', dateOnly: true })}
        </time>
      )
    case 'datetime':
      return <time dateTime={String(value)}>{formatDateTime(String(value), { timezone })}</time>
    case 'textarea':
      return <span className="azu-multiline">{String(value)}</span>
    default:
      return <>{String(value)}</>
  }
}
