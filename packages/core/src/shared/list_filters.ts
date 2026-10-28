import type { FilterKind, FilterSchema } from '../schema.ts'

/**
 * List filters as they live in the URL (FR-13): one query parameter
 * per filter, named after it. Plain TypeScript, shared by the server
 * and the front ends (non-negotiable 11).
 *
 * - `select`: one of its options, `status=published`
 * - `boolean`: `true` or `false`, `isFeatured=true`
 * - `dateRange`: dates in the admin's timezone, either end optional,
 *   `createdAt=2026-10-01..2026-10-31` or `createdAt=2026-10-01..`
 * - `belongsTo`: the related record's key, `category=3`
 * - `custom`: `1` when it's on, `low-stock=1`
 */

/** The list's own query parameters, which no filter may use */
export const LIST_PARAMS = ['page', 'perPage', 'sort', 'direction', 'search', 'columns'] as const

export type FilterValues = Record<string, string>

export type DateRange = { from: string | null; to: string | null }

/** Longest key a `belongsTo` filter accepts */
const MAX_KEY_LENGTH = 64

/**
 * Whether a string is a real calendar date, `YYYY-MM-DD`.
 */
export function isDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const [year, month, day] = match.slice(1).map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  )
}

/**
 * Reads `from..to`. Either end may be empty, not both; ends in the
 * wrong order are swapped.
 */
export function parseDateRange(value: string): DateRange | null {
  const match = /^([^.]*)\.\.([^.]*)$/.exec(value.trim())
  if (!match) return null
  const from = match[1] === '' ? null : match[1]
  const to = match[2] === '' ? null : match[2]
  if ((from === null && to === null) || (from && !isDate(from)) || (to && !isDate(to))) {
    return null
  }
  return from && to && from > to ? { from: to, to: from } : { from, to }
}

/**
 * The URL value for a date range, or `null` when both ends are empty.
 */
export function dateRangeValue(range: DateRange): string | null {
  if (!range.from && !range.to) return null
  return `${range.from ?? ''}..${range.to ?? ''}`
}

/**
 * A filter's value from the URL, normalised, or `null` when it's
 * missing or doesn't fit the filter, so a stale or hand-edited URL
 * still shows a list.
 */
export function parseFilterValue(
  filter: { kind: FilterKind; options: Record<string, string> | null },
  raw: string | undefined
): string | null {
  if (raw === undefined) return null
  const value = raw.trim()
  switch (filter.kind) {
    case 'select':
      return filter.options && Object.hasOwn(filter.options, value) ? value : null
    case 'boolean':
      return value === 'true' || value === 'false' ? value : null
    case 'dateRange': {
      const range = parseDateRange(value)
      return range ? dateRangeValue(range) : null
    }
    case 'belongsTo':
      return value !== '' && value.length <= MAX_KEY_LENGTH && /^[\w-]+$/.test(value) ? value : null
    case 'custom':
      return value === '1' ? '1' : null
  }
}

/**
 * The filter values with one changed; `null` removes it.
 */
export function withFilter(values: FilterValues, name: string, value: string | null): FilterValues {
  const next = { ...values }
  if (value === null || value === '') delete next[name]
  else next[name] = value
  return next
}

/**
 * How many filters are on, for a "Clear filters" button.
 */
export function activeFilters(values: FilterValues, filters: Pick<FilterSchema, 'name'>[]) {
  return filters.filter((filter) => Object.hasOwn(values, filter.name)).length
}
