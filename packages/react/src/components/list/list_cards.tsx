import { Link } from '@inertiajs/react'
import type { ColumnSchema, ListRow } from '@mezielabs/azu/types'
import { ListCell } from './cell.tsx'
import { ImageIcon } from '../shell_icons.tsx'

/**
 * The list below 768px: a card per row. The first image column is the
 * card's picture, the title column its heading, the next two columns a
 * line under it, and the first badge column sits on the right. A row the
 * user may view is a link to its detail page.
 */
export function ListCards(props: {
  label: string
  columns: ColumnSchema[]
  titleColumn: string | null
  rows: ListRow[]
  timezone: string
  rowHref?: (row: ListRow) => string | undefined
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

  if (props.rows.length === 0) return <p className="azu-table-empty azu-list-cards">No records</p>

  return (
    <ul className="azu-list-cards" aria-label={props.label}>
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
              <span className="azu-card-title">
                {title ? cell(title) : (row.title ?? String(row.id))}
              </span>
              {details.length > 0 && (
                <span className="azu-card-details">
                  {details.map((column, index) => (
                    <span key={column.name}>
                      {index > 0 && <span aria-hidden="true"> · </span>}
                      <span className="azu-visually-hidden">{column.label}: </span>
                      {cell(column)}
                    </span>
                  ))}
                </span>
              )}
            </span>
            {badge && <span className="azu-card-badge">{cell(badge)}</span>}
          </>
        )
        const href = props.rowHref?.(row)
        return (
          <li key={String(row.id)}>
            {href ? (
              <Link href={href} className="azu-card">
                {body}
              </Link>
            ) : (
              <div className="azu-card">{body}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
