import type { ListFilter, ListMeta } from '../schema.ts'
import { parseDateRange, type FilterValues } from './list_filters.ts'

const number = (value: number) => new Intl.NumberFormat('en').format(value)

/** `2026-10-01` → `1 Oct 2026` */
function day(date: string): string {
  const [year, month, dayOfMonth] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(Date.UTC(year, month - 1, dayOfMonth))
}

/**
 * What a filter's value reads as on its button and in the list's
 * summary: an option's label, Yes or No, the related record's title, a
 * date range. `null` when the filter is off. A custom filter, which is
 * on or off, reads as nothing more than its own label.
 */
export function filterValueLabel(
  filter: Pick<ListFilter, 'kind' | 'options' | 'selected'>,
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === '') return null
  switch (filter.kind) {
    case 'select':
      return filter.options?.[value] ?? value
    case 'boolean':
      return value === 'true' ? 'Yes' : 'No'
    case 'belongsTo':
      return filter.selected?.title ?? value
    case 'dateRange': {
      const range = parseDateRange(value)
      if (!range) return null
      if (range.from && range.to) return `${day(range.from)} – ${day(range.to)}`
      return range.from ? `from ${day(range.from)}` : `until ${day(range.to!)}`
    }
    case 'custom':
      return ''
  }
}

/**
 * The strip above the list (layout 2/4): "40 products", or with a search
 * or filters on, "32 of 40 products · filtered by Status: Published and
 * Low stock · matching “clay”".
 */
export function listSummary(input: {
  meta: Pick<ListMeta, 'total' | 'unfilteredTotal'>
  noun: { one: string; many: string }
  filters: ListFilter[]
  values: FilterValues
  search: string
}): string {
  const { total, unfilteredTotal } = input.meta
  const noun = (count: number) => (count === 1 ? input.noun.one : input.noun.many)
  const parts: string[] = []
  parts.push(
    unfilteredTotal === null
      ? `${number(total)} ${noun(total)}`
      : `${number(total)} of ${number(unfilteredTotal)} ${noun(unfilteredTotal)}`
  )
  const active = input.filters
    .map((filter) => {
      const value = filterValueLabel(filter, input.values[filter.name])
      if (value === null) return null
      return value === '' ? filter.label : `${filter.label}: ${value}`
    })
    .filter((text): text is string => text !== null)
  if (active.length > 0) {
    const list =
      active.length === 1 ? active[0] : `${active.slice(0, -1).join(', ')} and ${active.at(-1)}`
    parts.push(`filtered by ${list}`)
  }
  if (input.search) parts.push(`matching “${input.search}”`)
  return parts.join(' · ')
}

/**
 * The page buttons a footer shows: the first and last pages, the current
 * one and its neighbours, with `null` for each gap.
 * `pageWindow(6, 20)` → `[1, null, 5, 6, 7, null, 20]`.
 */
export function pageWindow(current: number, last: number): (number | null)[] {
  const pages = new Set([1, last, current - 1, current, current + 1])
  const sorted = [...pages].filter((page) => page >= 1 && page <= last).sort((a, b) => a - b)
  const out: (number | null)[] = []
  for (const page of sorted) {
    const previous = out.at(-1)
    if (typeof previous === 'number' && page - previous === 2) out.push(previous + 1)
    else if (typeof previous === 'number' && page - previous > 2) out.push(null)
    out.push(page)
  }
  return out
}
