import { lazy, Suspense, useId } from 'react'
import {
  activeFilters,
  dateRangeValue,
  parseDateRange,
  withFilter,
  type FilterValues,
} from '@mezielabs/azu/shared'
import type { ListFilter } from '@mezielabs/azu/types'

export type FilterControlProps = {
  filter: ListFilter
  /** The value the user last chose, which may be ahead of the server's */
  value: string | null
  onChange: (value: string | null) => void
}

/**
 * React Aria's ComboBox is most of a `belongsTo` filter's weight, so it
 * loads only on lists that have one, shared with the forms' relation
 * select.
 */
const RelationFilter = lazy(async () => ({
  default: (await import('./relation_filter.tsx')).RelationFilter,
}))

/** Holds the combobox's place while it loads, so the bar doesn't shift */
function RelationFilterPlaceholder({ filter }: FilterControlProps) {
  return (
    <div className="azu-filter" data-azu-filter={filter.name}>
      <span className="azu-filter-label">{filter.label}</span>
      <input
        className="azu-input azu-filter-placeholder"
        aria-label={filter.label}
        value={filter.selected?.title ?? ''}
        placeholder="All"
        disabled
        readOnly
      />
    </div>
  )
}

function SelectFilter({ filter, value, onChange }: FilterControlProps) {
  const id = useId()
  const choices: [string, string][] =
    filter.kind === 'boolean'
      ? [
          ['true', 'Yes'],
          ['false', 'No'],
        ]
      : Object.entries(filter.options ?? {})
  return (
    <div className="azu-filter" data-azu-filter={filter.name}>
      <label className="azu-filter-label" htmlFor={id}>
        {filter.label}
      </label>
      <select
        id={id}
        className="azu-input"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value || null)}
      >
        <option value="">All</option>
        {choices.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  )
}

/**
 * Two native date inputs: they read and write the `YYYY-MM-DD` the URL
 * holds, the browser supplies a picker, and the list page stays light.
 */
function DateRangeFilter({ filter, value, onChange }: FilterControlProps) {
  const id = useId()
  const range = (value ? parseDateRange(value) : null) ?? { from: null, to: null }
  const set = (end: 'from' | 'to', date: string) =>
    onChange(dateRangeValue({ ...range, [end]: date || null }))
  return (
    <fieldset className="azu-filter azu-filter-range" data-azu-filter={filter.name}>
      <legend className="azu-filter-label">{filter.label}</legend>
      <label className="azu-visually-hidden" htmlFor={`${id}-from`}>
        {filter.label} from
      </label>
      <input
        id={`${id}-from`}
        className="azu-input"
        type="date"
        value={range.from ?? ''}
        max={range.to ?? undefined}
        onChange={(event) => set('from', event.target.value)}
      />
      <span aria-hidden>–</span>
      <label className="azu-visually-hidden" htmlFor={`${id}-to`}>
        {filter.label} to
      </label>
      <input
        id={`${id}-to`}
        className="azu-input"
        type="date"
        value={range.to ?? ''}
        min={range.from ?? undefined}
        onChange={(event) => set('to', event.target.value)}
      />
    </fieldset>
  )
}

function CustomFilter({ filter, value, onChange }: FilterControlProps) {
  return (
    <label className="azu-filter azu-filter-toggle" data-azu-filter={filter.name}>
      <input
        type="checkbox"
        className="azu-filter-checkbox"
        checked={value === '1'}
        onChange={(event) => onChange(event.target.checked ? '1' : null)}
      />
      <span>{filter.label}</span>
    </label>
  )
}

/**
 * The list's filters (FR-13), each a URL parameter. A change replaces
 * the filter values; the page goes back to page 1 and keeps the search
 * and sort.
 */
export function FilterBar(props: {
  filters: ListFilter[]
  values: FilterValues
  label: string
  onChange: (values: FilterValues) => void
}) {
  if (props.filters.length === 0) return null
  const set = (name: string) => (value: string | null) =>
    props.onChange(withFilter(props.values, name, value))
  const active = activeFilters(props.values, props.filters)

  return (
    <div className="azu-filters" role="group" aria-label={`Filter ${props.label.toLowerCase()}`}>
      {props.filters.map((filter) => {
        const control = {
          filter,
          value: props.values[filter.name] ?? null,
          onChange: set(filter.name),
        }
        switch (filter.kind) {
          case 'select':
          case 'boolean':
            return <SelectFilter key={filter.name} {...control} />
          case 'dateRange':
            return <DateRangeFilter key={filter.name} {...control} />
          case 'custom':
            return <CustomFilter key={filter.name} {...control} />
          case 'belongsTo':
            return (
              <Suspense key={filter.name} fallback={<RelationFilterPlaceholder {...control} />}>
                <RelationFilter {...control} />
              </Suspense>
            )
        }
      })}
      {active > 0 && (
        <button
          type="button"
          className="azu-button azu-filters-clear"
          onClick={() => props.onChange({})}
        >
          Clear filters ({active})
        </button>
      )}
    </div>
  )
}
