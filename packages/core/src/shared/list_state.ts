/**
 * The list screen's state, as it lives in the URL: page, page size,
 * sort, and search. Plain TypeScript with no server or UI imports
 * (non-negotiable 11), so the server parses requests and the front end
 * builds URLs with the same rules.
 */

export const PAGE_SIZES = [10, 25, 50, 100] as const
export type PageSize = (typeof PAGE_SIZES)[number]

export type SortDirection = 'asc' | 'desc'

export type ListState = {
  page: number
  perPage: PageSize
  /** A sortable column name, or `null` for the default order */
  sort: string | null
  direction: SortDirection
  search: string
}

export type ListStateOptions = {
  /** The page size when the URL has none, from `config/admin.ts` */
  defaultPerPage: PageSize
  /** Column names the user may sort by. Anything else is ignored. */
  sortable: readonly string[]
}

/** Longest search term kept; the rest is dropped */
export const MAX_SEARCH_LENGTH = 200

type QueryInput = Record<string, unknown> | URLSearchParams

function read(query: QueryInput, key: string): string | undefined {
  const value = query instanceof URLSearchParams ? query.get(key) : query[key]
  const first = Array.isArray(value) ? value[0] : value
  return typeof first === 'string' ? first : typeof first === 'number' ? String(first) : undefined
}

export function isPageSize(value: number): value is PageSize {
  return (PAGE_SIZES as readonly number[]).includes(value)
}

/**
 * Reads list state from URL query parameters. Invalid or unknown values
 * fall back to defaults rather than erroring, so a hand-edited or stale
 * URL still shows a list.
 */
export function parseListState(query: QueryInput, options: ListStateOptions): ListState {
  const page = Number.parseInt(read(query, 'page') ?? '', 10)
  const perPage = Number.parseInt(read(query, 'perPage') ?? '', 10)
  const sort = read(query, 'sort') ?? null
  const direction = read(query, 'direction') === 'desc' ? 'desc' : 'asc'
  const search = (read(query, 'search') ?? '').trim().slice(0, MAX_SEARCH_LENGTH)

  return {
    page: Number.isInteger(page) && page > 0 ? page : 1,
    perPage: isPageSize(perPage) ? perPage : options.defaultPerPage,
    sort: sort !== null && options.sortable.includes(sort) ? sort : null,
    direction: sort !== null && options.sortable.includes(sort) ? direction : 'asc',
    search,
  }
}

/**
 * Query parameters for a list state, leaving out defaults so URLs stay
 * short: page 1, the default page size, no sort, no search.
 */
export function listStateToQuery(
  state: ListState,
  options: Pick<ListStateOptions, 'defaultPerPage'>
): Record<string, string> {
  const query: Record<string, string> = {}
  if (state.search) query.search = state.search
  if (state.sort) {
    query.sort = state.sort
    query.direction = state.direction
  }
  if (state.perPage !== options.defaultPerPage) query.perPage = String(state.perPage)
  if (state.page > 1) query.page = String(state.page)
  return query
}

/**
 * The URL for a list state: `/admin/resources/products?sort=price&direction=desc`.
 */
export function listStateUrl(
  path: string,
  state: ListState,
  options: Pick<ListStateOptions, 'defaultPerPage'>
): string {
  const query = new URLSearchParams(listStateToQuery(state, options)).toString()
  return query ? `${path}?${query}` : path
}

/**
 * The next state after a user action. Changing the search, sort or page
 * size goes back to page 1, so the user never lands past the end.
 */
export function nextListState(state: ListState, change: Partial<ListState>): ListState {
  const resetsPage =
    'search' in change || 'sort' in change || 'direction' in change || 'perPage' in change
  return { ...state, ...change, page: change.page ?? (resetsPage ? 1 : state.page) }
}
