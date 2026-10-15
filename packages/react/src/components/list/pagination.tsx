import type { ListMeta } from '@mezielabs/azu/types'

export function Pagination(props: { meta: ListMeta; onPage: (page: number) => void }) {
  const { total, currentPage, lastPage, perPage } = props.meta
  // Still a live region with no records (the table says so on screen),
  // so a filter that matches nothing is announced too
  if (total === 0) {
    return (
      <nav className="azu-pagination" aria-label="Pagination">
        <p className="azu-visually-hidden" aria-live="polite">
          No records
        </p>
      </nav>
    )
  }
  const from = (currentPage - 1) * perPage + 1
  const to = Math.min(currentPage * perPage, total)

  return (
    <nav className="azu-pagination" aria-label="Pagination">
      <p className="azu-pagination-summary" aria-live="polite">
        {from}–{to} of {total}
      </p>
      <div className="azu-toolbar">
        <button
          type="button"
          className="azu-button"
          disabled={currentPage <= 1}
          onClick={() => props.onPage(currentPage - 1)}
        >
          Previous
        </button>
        <span className="azu-pagination-page">
          Page {currentPage} of {lastPage}
        </span>
        <button
          type="button"
          className="azu-button"
          disabled={currentPage >= lastPage}
          onClick={() => props.onPage(currentPage + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  )
}
