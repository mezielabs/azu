import { useEffect, useRef, useState } from 'react'
import type { ListState } from '@mezielabs/azu/shared'
import { SearchIcon } from '../shell_icons.tsx'

/**
 * The list's search. It waits for a pause in typing, or Enter. Rows per
 * page live in the list's footer (`Pagination`).
 */
export function ListToolbar(props: {
  state: ListState
  searchable: boolean
  label: string
  onSearch: (term: string) => void
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

  if (!props.searchable) return null
  return (
    <form
      role="search"
      className="azu-search"
      onSubmit={(event) => {
        event.preventDefault()
        search(term, 0)
      }}
    >
      <label className="azu-search-field">
        <SearchIcon />
        <span className="azu-visually-hidden">Search {props.label.toLowerCase()}</span>
        <input
          id="azu-list-search"
          className="azu-search-input"
          type="search"
          placeholder="Search"
          value={term}
          onChange={(event) => {
            setTerm(event.target.value)
            search(event.target.value, 300)
          }}
        />
      </label>
    </form>
  )
}
