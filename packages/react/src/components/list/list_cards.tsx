import { Link } from '@inertiajs/react'
import type { ReactNode } from 'react'
import type { ColumnSchema, ListRow } from '@mezielabs/azu/types'
import { ListCell } from './cell.tsx'
import { ImageIcon } from '../shell_icons.tsx'

/**
 * The list below 768px: a card per row. The first image column is the
 * card's picture, the title column its heading, the next two columns on
 * separate lines below it, then the first badge column. A row the
 * user may view is a link to its detail page; its menu (View, Edit, row
 * actions) is a 44px button beside it, outside the link.
 */
export function ListCards(props: {
  label: string
  columns: ColumnSchema[]
  titleColumn: string | null
  rows: ListRow[]
  timezone: string
  rowHref?: (row: ListRow) => string | undefined
  /** The row's menu, a 44px button beside the content, outside the card's link */
  rowMenu?: (row: ListRow) => ReactNode
  /** Shown when there are no rows. Defaults to "No records" */
  emptyState?: ReactNode
  /** Controlled selection replaces navigation while selecting records. */
  selection?: {
    ids: (string | number)[]
    onChange: (id: string | number, selected: boolean) => void
  }
}) {
  const visible = props.columns.filter((column) => !column.hiddenByDefault)
  const image = visible.find((column) => column.kind === 'image')
  const title =
    visible.find((column) => column.name === props.titleColumn) ??
    visible.find((column) => column.kind === 'text' || column.kind === 'belongsTo')
  const badge = visible.find((column) => column.kind === 'badge')
  const details = visible
    .filter((column) => column !== image && column !== title && column !== badge)
    .slice(0, 2)

  if (props.rows.length === 0) {
    return <div className="azu-table-empty azu-list-cards">{props.emptyState ?? 'No records'}</div>
  }

  return (
    <ul className="azu-list-cards" aria-label={props.label} tabIndex={-1}>
      {props.rows.map((row) => {
        const cell = (column: ColumnSchema) => (
          <ListCell
            column={column}
            value={row.cells[column.name] ?? null}
            row={row}
            timezone={props.timezone}
          />
        )
        const body = (
          <>
            {image && <span className="azu-card-picture">{cell(image)}</span>}
            {!image && (
              <span className="azu-card-picture azu-thumbnail-empty" aria-hidden="true">
                <ImageIcon />
              </span>
            )}
            <span className="azu-card-text">
              <span className="azu-card-title" title={row.title ?? undefined}>
                {title
                  ? title.kind === 'text' && !title.component
                    ? String(row.cells[title.name] ?? row.title ?? row.id)
                    : cell(title)
                  : (row.title ?? String(row.id))}
              </span>
              {details.length > 0 && (
                <span className="azu-card-details">
                  {details.map((column) => (
                    <span key={column.name}>
                      <span className="azu-visually-hidden">{column.label}: </span>
                      {cell(column)}
                    </span>
                  ))}
                </span>
              )}
              {badge && <span className="azu-card-badge">{cell(badge)}</span>}
            </span>
          </>
        )
        const href = props.rowHref?.(row)
        return (
          <li key={String(row.id)} className="azu-card">
            {props.selection && (
              <label className="azu-card-selection">
                <input
                  type="checkbox"
                  checked={props.selection.ids.includes(row.id)}
                  aria-label={`Select ${row.title ?? row.id}`}
                  onChange={(event) => props.selection!.onChange(row.id, event.target.checked)}
                />
              </label>
            )}
            {href && !props.selection ? (
              <Link href={href} className="azu-card-link">
                {body}
              </Link>
            ) : (
              <div className="azu-card-link">{body}</div>
            )}
            {!props.selection && props.rowMenu?.(row)}
          </li>
        )
      })}
    </ul>
  )
}
