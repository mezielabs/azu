import { useId } from 'react'
import type { ColumnSchema } from '@mezielabs/azu/types'
import type { ListState } from '@mezielabs/azu/shared'

/** Sorting and explicit selection mode for the phone card view. */
export function MobileListControls(props: {
  columns: ColumnSchema[]
  state: ListState
  canSelect: boolean
  selecting: boolean
  onSort: (sort: string | null, direction: 'asc' | 'desc') => void
  onSelect: () => void
  onSelectPage: () => void
  onDone: () => void
}) {
  const id = useId()
  const sortable = props.columns.filter((column) => column.sortable)
  return (
    <div className="azu-mobile-list-controls">
      {props.selecting ? (
        <>
          <button type="button" className="azu-button" onClick={props.onSelectPage}>
            Select this page
          </button>
          <button type="button" className="azu-button" onClick={props.onDone}>
            Done selecting
          </button>
        </>
      ) : (
        <>
          {sortable.length > 0 && (
            <div className="azu-mobile-sort">
              <label htmlFor={id}>Sort by</label>
              <select
                id={id}
                className="azu-input"
                value={props.state.sort ? `${props.state.sort}:${props.state.direction}` : ''}
                onChange={(event) => {
                  const chosen = sortable.find(
                    (column) =>
                      event.target.value === `${column.name}:asc` ||
                      event.target.value === `${column.name}:desc`
                  )
                  props.onSort(
                    chosen?.name ?? null,
                    event.target.value.endsWith(':desc') ? 'desc' : 'asc'
                  )
                }}
              >
                <option value="">Default order</option>
                {sortable.flatMap((column) =>
                  ['asc', 'desc'].map((direction) => (
                    <option
                      key={`${column.name}:${direction}`}
                      value={`${column.name}:${direction}`}
                    >
                      {column.label} — {direction === 'asc' ? 'ascending' : 'descending'}
                    </option>
                  ))
                )}
              </select>
            </div>
          )}
          {props.canSelect && (
            <button type="button" className="azu-button" onClick={props.onSelect}>
              Select records
            </button>
          )}
        </>
      )}
    </div>
  )
}
