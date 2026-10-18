import { formatDateTime, formatDecimal, formatNumber } from '@mezielabs/azu/shared'
import { Link } from '@inertiajs/react'
import type {
  ColumnSchema,
  FieldSchema,
  FieldValue,
  FileValue,
  RelationValue,
} from '@mezielabs/azu/types'
import { ListCell } from '../list/cell.tsx'

const EMPTY = <span className="azu-cell-empty">—</span>

/** Column kinds whose formatting a detail value borrows */
const FORMATTED = new Set(['number', 'decimal', 'badge', 'boolean'])
/** Field kinds whose value is the plain attribute a column formats */
const PLAIN = new Set(['text', 'number', 'decimal', 'select', 'boolean'])

/**
 * A field's value on the detail page, read-only. Formatting lives in
 * `@mezielabs/azu/shared` (non-negotiable 11); this only renders.
 *
 * Given the list column of the same name (layout 3/4), a number,
 * decimal, badge or boolean value is shown as the list shows it: the
 * column's currency format, its badge colour and label.
 */
export function FieldValueView(props: {
  field: FieldSchema
  value: FieldValue
  timezone: string
  column?: ColumnSchema
}) {
  const { field, value, timezone, column } = props
  if (value === null || value === '') return EMPTY

  if (column && !column.component && FORMATTED.has(column.kind) && PLAIN.has(field.kind)) {
    const row = { id: '', title: null, cells: {}, abilities: { view: false, update: false, actions: [] } }
    return (
      <ListCell
        column={column}
        value={value as string | number | boolean}
        row={row}
        timezone={timezone}
      />
    )
  }

  switch (field.kind) {
    case 'manyToMany': {
      const related = value as RelationValue[]
      if (related.length === 0) return EMPTY
      return (
        <ul className="azu-related-list">
          {related.map((item) => {
            const label = item.title ?? String(item.id)
            return (
              <li key={item.id}>{item.href ? <Link href={item.href}>{label}</Link> : label}</li>
            )
          })}
        </ul>
      )
    }
    case 'belongsTo': {
      const related = value as RelationValue
      const label = related.title ?? String(related.id)
      return related.href ? <Link href={related.href}>{label}</Link> : <>{label}</>
    }
    case 'richText':
      // Sanitised on the server, on the way in and again on the way out
      return (
        <div
          className="azu-rich-text-content"
          dangerouslySetInnerHTML={{ __html: String(value) }}
        />
      )
    case 'image': {
      const file = value as FileValue
      return file.url ? (
        <a href={file.url} target="_blank" rel="noopener noreferrer">
          <img className="azu-detail-image" src={file.url} alt={`${field.label}: ${file.name}`} />
        </a>
      ) : (
        <>{file.name}</>
      )
    }
    case 'file': {
      const file = value as FileValue
      return file.url ? (
        <a href={file.url} target="_blank" rel="noopener noreferrer">
          {file.name}
        </a>
      ) : (
        <>{file.name}</>
      )
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
