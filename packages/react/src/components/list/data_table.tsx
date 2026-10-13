import { useEffect, useMemo, useState } from 'react'
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
import { ListCell } from './cell.tsx'

const cx = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(' ')

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
 * all" as the sentinel `'all'`; FR-17 will offer "all N matching".
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
}) {
  const { columns, rows, state, onSort, onSelectionChange } = props
  const visible = columns.filter((column) => !column.hiddenByDefault)
  const rowHeader = rowHeaderColumn(visible, props.titleColumn)
  const [selection, setSelection] = useState<Selection>(new Set())
  const rowKey = useMemo(() => rows.map((row) => row.id).join(','), [rows])

  useEffect(() => {
    setSelection(new Set())
    onSelectionChange?.([])
  }, [rowKey])

  const sortDescriptor: SortDescriptor | undefined = state.sort
    ? { column: state.sort, direction: state.direction === 'desc' ? 'descending' : 'ascending' }
    : undefined

  return (
    <div className="azu-table-container">
      <Table
        aria-label={props.label}
        className="azu-table"
        selectionMode="multiple"
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
          <Column className="azu-th azu-th-selection">
            <SelectionCheckbox />
          </Column>
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
                  {column.label}
                  {sortDirection && (
                    <span aria-hidden className="azu-sort-indicator">
                      {sortDirection === 'ascending' ? '▲' : '▼'}
                    </span>
                  )}
                </span>
              )}
            </Column>
          ))}
        </TableHeader>
        <TableBody
          items={rows}
          renderEmptyState={() => <p className="azu-table-empty">No records</p>}
        >
          {(row) => (
            <Row
              id={row.id as Key}
              textValue={row.title ?? String(row.id)}
              className={({ isSelected, isFocusVisible }) =>
                cx('azu-row', isSelected && 'azu-is-selected', isFocusVisible && 'azu-is-focused')
              }
            >
              <Cell className="azu-td azu-td-selection">
                <SelectionCheckbox />
              </Cell>
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
                  <ListCell
                    column={column}
                    value={row.cells[column.name] ?? null}
                    row={row}
                    timezone={props.timezone}
                  />
                </Cell>
              ))}
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
