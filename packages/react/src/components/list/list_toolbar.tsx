import { useEffect, useRef, useState } from 'react'
import { PAGE_SIZES, type ListState, type PageSize } from '@mezielabs/azu/shared'

/**
 * Search and page size. Search waits for a pause in typing, or Enter.
 */
export function ListToolbar(props: {
  state: ListState
  searchable: boolean
  label: string
  onSearch: (term: string) => void
  onPerPage: (size: PageSize) => void
}) {
  const [term, setTerm] = useState(props.state.search)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Back and forward navigation change the URL's search under us
  useEffect(() => setTerm(props.state.search), [props.state.search])
  useEffect(() => () => clearTimeout(timer.current), [])

  function search(value: string, delay: number) {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      if (value.trim() !== props.state.search) props.onSearch(value.trim())
    }, delay)
  }

  return (
    <div className="azu-toolbar azu-list-toolbar">
      {props.searchable && (
        <form
          role="search"
          className="azu-search"
          onSubmit={(event) => {
            event.preventDefault()
            search(term, 0)
          }}
        >
          <label className="azu-visually-hidden" htmlFor="azu-list-search">
            Search {props.label.toLowerCase()}
          </label>
          <input
            id="azu-list-search"
            className="azu-input"
            type="search"
            placeholder="Search"
            value={term}
            onChange={(event) => {
              setTerm(event.target.value)
              search(event.target.value, 300)
            }}
          />
        </form>
      )}
      <label className="azu-per-page">
        <span>Rows per page</span>
        <select
          className="azu-input"
          value={props.state.perPage}
          onChange={(event) => props.onPerPage(Number(event.target.value) as PageSize)}
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
