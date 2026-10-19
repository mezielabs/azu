import type { FilterSchema } from '../schema.ts'
import { parseFilterValue, type FilterValues } from './list_filters.ts'

/**
 * The list screen's state, as it lives in the URL: page, page size,
 * sort, search and filters (`list_filters.ts`). Plain TypeScript with no server or UI imports
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
  /** Filter name → its URL value, only for filters that are on */
  filters: FilterValues
}

export type ListStateOptions = {
  /** The page size when the URL has none, from `config/azu.ts` */
  defaultPerPage: PageSize
  /** Column names the user may sort by. Anything else is ignored. */
  sortable: readonly string[]
  /** The filters this user may use. Other parameters are ignored. */
  filters?: readonly Pick<FilterSchema, 'name' | 'kind' | 'options'>[]
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
  const filters: FilterValues = {}
  for (const filter of options.filters ?? []) {
    const value = parseFilterValue(filter, read(query, filter.name))
    if (value !== null) filters[filter.name] = value
  }

  return {
    page: Number.isInteger(page) && page > 0 ? page : 1,
    perPage: isPageSize(perPage) ? perPage : options.defaultPerPage,
    sort: sort !== null && options.sortable.includes(sort) ? sort : null,
    direction: sort !== null && options.sortable.includes(sort) ? direction : 'asc',
    search,
    filters,
  }
}

/**
 * Query parameters for a list state, leaving out defaults so URLs stay
 * short: page 1, the default page size, no sort, no search, no filters.
 */
export function listStateToQuery(
  state: ListState,
  options: Pick<ListStateOptions, 'defaultPerPage'>
): Record<string, string> {
  const query: Record<string, string> = {}
  if (state.search) query.search = state.search
  for (const [name, value] of Object.entries(state.filters)) query[name] = value
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
 * The next state after a user action. Changing the search, a filter,
 * the sort or the page size goes back to page 1, so the user never
 * lands past the end.
 */
export function nextListState(state: ListState, change: Partial<ListState>): ListState {
  const resetsPage =
    'search' in change ||
    'filters' in change ||
    'sort' in change ||
    'direction' in change ||
    'perPage' in change
  return { ...state, ...change, page: change.page ?? (resetsPage ? 1 : state.page) }
}

/**
 * The current URL with one page parameter changed, such as a detail
 * page's `productsPage` for its `hasMany` table. Page 1 is left out,
 * like list defaults. Other parameters are kept.
 */
export function withPageParam(url: string, param: string, page: number): string {
  const [path, query = ''] = url.split('?', 2)
  const params = new URLSearchParams(query)
  if (page > 1) params.set(param, String(page))
  else params.delete(param)
  const search = params.toString()
  return search ? `${path}?${search}` : path
}
