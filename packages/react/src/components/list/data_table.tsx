import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Cell,
  Checkbox,
  Column,
  Row,
  Table,
  TableBody,
  TableHeader,
  type Key,
  type Selection,
  type SortDescriptor,
} from 'react-aria-components'
import type { ColumnSchema, ListRow } from '@mezielabs/azu/types'
import type { ListState } from '@mezielabs/azu/shared'
import { Link } from '@inertiajs/react'
import { ListCell } from './cell.tsx'
import { SortIcon } from '../shell_icons.tsx'

const cx = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(' ')

/**
 * The title cell is a real link to the record's detail page, when the
 * user may open it; the rest of the row isn't.
 */
function TitleLink(props: { href: string | undefined; children: ReactNode }) {
  if (!props.href) return <>{props.children}</>
  return (
    <Link href={props.href} className="azu-title-link">
      {props.children}
    </Link>
  )
}

function SelectionCheckbox() {
  return (
    <Checkbox slot="selection" className="azu-checkbox">
      {({ isSelected, isIndeterminate }) => (
        <span
          className={cx('azu-checkbox-box', (isSelected || isIndeterminate) && 'azu-is-selected')}
          aria-hidden
        >
          {isIndeterminate ? '–' : isSelected ? '✓' : ''}
        </span>
      )}
    </Checkbox>
  )
}

/**
 * The ids a selection covers on this page. React Aria reports "select
 * all" as the sentinel `'all'`. Rows past this page ("Select all N
 * matching", FR-17) are the list page's to offer.
 */
export function selectedIds(selection: Selection, rows: ListRow[]): (string | number)[] {
  if (selection === 'all') return rows.map((row) => row.id)
  return rows.filter((row) => selection.has(row.id)).map((row) => row.id)
}

/**
 * The list table: React Aria's Table, sorted on the server. Rows are
 * selectable for the bulk actions FR-12 adds. The selection is cleared
 * whenever the rows change (a new page, sort or search), so it never
 * holds rows that aren't on screen.
 *
 * A row the user may view has its title cell as a real link to the
 * detail page, so it can be opened in a new tab and announced as a
 * link; selection stays on the checkboxes (or Space).
 */
export function DataTable(props: {
  label: string
  columns: ColumnSchema[]
  /** The resource's title attribute: its column names each row */
  titleColumn: string | null
  rows: ListRow[]
  state: ListState
  timezone: string
  onSort: (column: string, direction: 'asc' | 'desc') => void
  onSelectionChange?: (ids: (string | number)[]) => void
  /** The detail page URL for a row's title link, or `undefined` when it has none */
  rowHref?: (row: ListRow) => string | undefined
  /** Checkbox selection, for bulk actions. Defaults to on */
  selectable?: boolean
  /** A last column with each row's actions (FR-12) */
  rowActions?: (row: ListRow) => ReactNode
  /** Changing it clears the selection, e.g. after a bulk action */
  clearSelection?: number
  /** Shown in place of the rows when there are none. Defaults to "No records" */
  emptyState?: ReactNode
}) {
  const selectable = props.selectable ?? true
  const { columns, rows, state, onSort, onSelectionChange } = props
  const visible = columns.filter((column) => !column.hiddenByDefault)
  const rowHeader = rowHeaderColumn(visible, props.titleColumn)
  const [selection, setSelection] = useState<Selection>(new Set())
  const rowKey = useMemo(() => rows.map((row) => row.id).join(','), [rows])

  useEffect(() => {
    setSelection(new Set())
    onSelectionChange?.([])
  }, [rowKey, props.clearSelection])

  // The header cells' widths while there are rows, held while there are
  // none, so a search that matches nothing doesn't move the columns. A
  // scoped stylesheet sets them: React Aria's Column doesn't render
  // `style`, and it re-creates its cells, so writing to them is lost.
  const element = useRef<HTMLTableElement>(null)
  const tableId = useId()
  const [widths, setWidths] = useState<number[] | null>(null)
  useLayoutEffect(() => {
    const table = element.current
    if (rows.length === 0 || !table) return
    // React Aria renders the cells after a first pass, and the window
    // can resize: measure whenever the table's size changes
    const measure = () => {
      const cells = [...table.querySelectorAll<HTMLElement>('thead th')]
      if (cells.length === 0) return
      const measured = cells.map((cell) => Math.round(cell.getBoundingClientRect().width))
      setWidths((current) => (current?.join() === measured.join() ? current : measured))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(table)
    return () => observer.disconnect()
  }, [rowKey, columns])
  const held = rows.length === 0 && widths !== null

  const sortDescriptor: SortDescriptor | undefined = state.sort
    ? { column: state.sort, direction: state.direction === 'desc' ? 'descending' : 'ascending' }
    : undefined

  return (
    <div className="azu-table-container">
      {held && (
        <style>
          {widths
            .map(
              (width, index) =>
                `.azu-table[data-azu-table="${tableId}"] thead th:nth-child(${index + 1}) { width: ${width}px; }`
            )
            .join('\n')}
        </style>
      )}
      <Table
        ref={element}
        aria-label={props.label}
        className="azu-table"
        data-azu-table={tableId}
        data-azu-held={held || undefined}
        selectionMode={selectable ? 'multiple' : 'none'}
        selectedKeys={selection}
        onSelectionChange={(next) => {
          setSelection(next)
          onSelectionChange?.(selectedIds(next, rows))
        }}
        sortDescriptor={sortDescriptor}
        onSortChange={(next) =>
          onSort(String(next.column), next.direction === 'descending' ? 'desc' : 'asc')
        }
      >
        <TableHeader>
          {selectable && (
            <Column className="azu-th azu-th-selection">
              <SelectionCheckbox />
            </Column>
          )}
          {visible.map((column) => (
            <Column
              key={column.name}
              id={column.name}
              isRowHeader={column.name === rowHeader}
              allowsSorting={column.sortable}
              className={cx('azu-th', isNumeric(column) && 'azu-is-numeric')}
            >
              {({ sortDirection }) => (
                <span className="azu-th-inner">
                  {/* An image column's pictures speak for themselves; screen readers get the label */}
                  {column.kind === 'image' ? (
                    <span className="azu-visually-hidden">{column.label}</span>
                  ) : (
                    column.label
                  )}
                  {/* Sortable columns show a hint; the sorted one its direction */}
                  {column.sortable && (
                    <span
                      className="azu-sort-indicator"
                      data-azu-sorted={sortDirection ?? undefined}
                    >
                      <SortIcon direction={sortDirection ?? null} />
                    </span>
                  )}
                </span>
              )}
            </Column>
          ))}
          {props.rowActions && (
            <Column className="azu-th azu-th-actions">
              <span className="azu-visually-hidden">Actions</span>
            </Column>
          )}
        </TableHeader>
        <TableBody
          items={rows}
          renderEmptyState={() => (
            <div className="azu-table-empty">{props.emptyState ?? 'No records'}</div>
          )}
        >
          {(row) => (
            <Row
              id={row.id as Key}
              textValue={row.title ?? String(row.id)}
              className={({ isSelected, isFocusVisible }) =>
                cx('azu-row', isSelected && 'azu-is-selected', isFocusVisible && 'azu-is-focused')
              }
            >
              {selectable && (
                <Cell className="azu-td azu-td-selection">
                  <SelectionCheckbox />
                </Cell>
              )}
              {visible.map((column) => (
                <Cell
                  key={column.name}
                  className={({ isFocusVisible }) =>
                    cx(
                      'azu-td',
                      isNumeric(column) && 'azu-is-numeric',
                      isFocusVisible && 'azu-is-focused'
                    )
                  }
                >
                  <TitleLink href={column.name === rowHeader ? props.rowHref?.(row) : undefined}>
                    <ListCell
                      column={column}
                      value={row.cells[column.name] ?? null}
                      row={row}
                      timezone={props.timezone}
                    />
                  </TitleLink>
                </Cell>
              ))}
              {props.rowActions && (
                <Cell className="azu-td azu-td-actions">{props.rowActions(row)}</Cell>
              )}
            </Row>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

/**
 * The column screen readers announce each row by: the title column if
 * it's shown, else the first text-like column, never a thumbnail.
 */
function rowHeaderColumn(columns: ColumnSchema[], title: string | null): string | undefined {
  if (title && columns.some((column) => column.name === title)) return title
  return (
    columns.find((column) => column.kind === 'text' || column.kind === 'belongsTo') ?? columns[0]
  )?.name
}

function isNumeric(column: ColumnSchema) {
  return column.kind === 'number' || column.kind === 'decimal'
}
