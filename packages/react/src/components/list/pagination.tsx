import { useId } from 'react'
import { PAGE_SIZES, listRange, pageWindow, type PageSize } from '@mezielabs/azu/shared'
import type { ListMeta } from '@mezielabs/azu/types'

/**
 * The list card's footer: which rows are showing ("Showing 1–25 of 30",
 * with "· filtered from 40" when a search or filter is on), rows per
 * page, and the pages (Previous, numbers, Next). Below 768px, the count
 * and Previous and Next.
 */
export function Pagination(props: {
  meta: ListMeta
  onPage: (page: number) => void
  onPerPage?: (size: PageSize) => void
}) {
  const id = useId()
  const { total, currentPage, lastPage, perPage } = props.meta
  const range = listRange(props.meta)

  return (
    <footer className="azu-list-footer">
      {/* A live region, so a filter that matches nothing is announced too */}
      <p className="azu-pagination-summary" aria-live="polite">
        {total === 0 ? (
          'No records'
        ) : (
          <>
            Showing{' '}
            <strong>
              {range.from}–{range.to}
            </strong>{' '}
            of {range.total}
          </>
        )}
        {range.filteredFrom !== null && (
          <span className="azu-pagination-filtered"> · filtered from {range.filteredFrom}</span>
        )}
      </p>
      <div className="azu-list-footer-controls">
        {props.onPerPage && (
          <div className="azu-per-page">
            <label htmlFor={id}>Rows per page</label>
            <select
              id={id}
              className="azu-input"
              value={perPage}
              onChange={(event) => props.onPerPage!(Number(event.target.value) as PageSize)}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        )}
        {lastPage > 1 && (
          <nav className="azu-pagination" aria-label="Pagination">
            <button
              type="button"
              className="azu-page-button"
              disabled={currentPage <= 1}
              onClick={() => props.onPage(currentPage - 1)}
            >
              Previous
            </button>
            {pageWindow(currentPage, lastPage).map((page, index) =>
              page === null ? (
                <span key={`gap-${index}`} className="azu-page-gap" aria-hidden="true">
                  …
                </span>
              ) : (
                <button
                  key={page}
                  type="button"
                  className="azu-page-button azu-page-number"
                  aria-current={page === currentPage ? 'page' : undefined}
                  aria-label={`Page ${page}`}
                  onClick={() => props.onPage(page)}
                >
                  {page}
                </button>
              )
            )}
            <button
              type="button"
              className="azu-page-button"
              disabled={currentPage >= lastPage}
              onClick={() => props.onPage(currentPage + 1)}
            >
              Next
            </button>
          </nav>
        )}
      </div>
    </footer>
  )
}
