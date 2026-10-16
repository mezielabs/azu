import { Suspense } from 'react'
import {
  formatDateTime,
  formatDecimal,
  formatNumber,
  formatRelative,
  truncate,
} from '@mezielabs/azu/shared'
import type { CellValue, ColumnSchema, ListRow } from '@mezielabs/azu/types'
import { useComponent } from '../registry.tsx'

const EMPTY = <span className="azu-cell-empty">—</span>

/**
 * One list cell, by column kind. Formatting lives in
 * `@mezielabs/azu/shared` (non-negotiable 11); this only renders.
 */
export function ListCell(props: {
  column: ColumnSchema
  value: CellValue
  row: ListRow
  timezone: string
}) {
  const { column, value, row, timezone } = props
  const Custom = useComponent(column.component ?? undefined)
  if (Custom) {
    // One line of text, the height of a cell, while a lazy component loads
    return (
      <Suspense fallback={<span className="azu-cell-loading" aria-busy="true" />}>
        <Custom value={value} record={row} column={column} />
      </Suspense>
    )
  }

  switch (column.kind) {
    case 'belongsTo': {
      const related = value as { title: string | null } | null
      return related?.title ? <>{related.title}</> : EMPTY
    }
    case 'image': {
      const url = (value as { url: string | null } | null)?.url
      return url ? <img className="azu-thumbnail" src={url} alt="" loading="lazy" /> : EMPTY
    }
    case 'number':
      return value === null ? EMPTY : <>{formatNumber(value as number, column.format)}</>
    case 'decimal':
      return value === null ? EMPTY : <>{formatDecimal(value as string, column.format)}</>
    case 'boolean':
      return (
        <span className="azu-boolean" data-azu-value={value ? 'true' : 'false'}>
          <span aria-hidden>{value ? '✓' : '✗'}</span>
          <span className="azu-visually-hidden">{value ? 'Yes' : 'No'}</span>
        </span>
      )
    case 'badge':
      return value === null ? (
        EMPTY
      ) : (
        <span className="azu-badge" data-azu-color={column.colors?.[String(value)] ?? 'gray'}>
          {String(value)}
        </span>
      )
    case 'date':
    case 'datetime': {
      const iso = value as string | null
      if (!iso) return EMPTY
      return (
        <time dateTime={iso} title={formatRelative(iso, new Date())}>
          {formatDateTime(iso, { timezone, dateOnly: column.kind === 'date' })}
        </time>
      )
    }
    default: {
      if (value === null || value === '') return EMPTY
      const text = String(value)
      const short = truncate(text)
      return <span title={short === text ? undefined : text}>{short}</span>
    }
  }
}
