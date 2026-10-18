import { lazy, Suspense, useId } from 'react'
import { Button, Dialog, DialogTrigger, Modal, ModalOverlay, Popover } from 'react-aria-components'
import {
  activeFilters,
  dateRangeValue,
  filterValueLabel,
  parseDateRange,
  withFilter,
  type FilterValues,
} from '@mezielabs/azu/shared'
import type { ListFilter } from '@mezielabs/azu/types'
import { ChevronDownIcon, FiltersIcon } from '../shell_icons.tsx'

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
 * Two native date inputs, each with a visible label ("From", "To"):
 * they read and write the `YYYY-MM-DD` the URL holds, the browser
 * supplies a picker, and the list page stays light.
 */
function DateRangeFilter({ filter, value, onChange }: FilterControlProps) {
  const id = useId()
  const range = (value ? parseDateRange(value) : null) ?? { from: null, to: null }
  const set = (end: 'from' | 'to', date: string) =>
    onChange(dateRangeValue({ ...range, [end]: date || null }))
  return (
    <fieldset className="azu-filter azu-filter-range" data-azu-filter={filter.name}>
      <legend className="azu-filter-label">{filter.label}</legend>
      <div className="azu-range-field">
        <label className="azu-range-label" htmlFor={`${id}-from`}>
          From
        </label>
        <input
          id={`${id}-from`}
          className="azu-input"
          type="date"
          value={range.from ?? ''}
          max={range.to ?? undefined}
          onChange={(event) => set('from', event.target.value)}
        />
      </div>
      <div className="azu-range-field">
        <label className="azu-range-label" htmlFor={`${id}-to`}>
          To
        </label>
        <input
          id={`${id}-to`}
          className="azu-input"
          type="date"
          value={range.to ?? ''}
          min={range.from ?? undefined}
          onChange={(event) => set('to', event.target.value)}
        />
      </div>
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

/** A filter's own control, by kind: in a button's popover, or the phone sheet */
function FilterControl(props: FilterControlProps) {
  switch (props.filter.kind) {
    case 'select':
    case 'boolean':
      return <SelectFilter {...props} />
    case 'dateRange':
      return <DateRangeFilter {...props} />
    case 'custom':
      return <CustomFilter {...props} />
    case 'belongsTo':
      return (
        <Suspense fallback={<RelationFilterPlaceholder {...props} />}>
          <RelationFilter {...props} />
        </Suspense>
      )
  }
}

/**
 * One filter as a button: its label, and its value when it's on (the
 * button is then tinted). It opens the filter's control in a popover; an
 * on/off filter (`filter.custom`) is a toggle button instead.
 */
function FilterButton({ filter, value, onChange }: FilterControlProps) {
  const shown = filterValueLabel(filter, value)
  const active = shown !== null
  if (filter.kind === 'custom') {
    return (
      <button
        type="button"
        className="azu-filter-button"
        data-azu-filter-button={filter.name}
        data-azu-active={active || undefined}
        aria-pressed={active}
        onClick={() => onChange(active ? null : '1')}
      >
        {filter.label}
      </button>
    )
  }
  return (
    <DialogTrigger>
      <Button
        className="azu-filter-button"
        data-azu-filter-button={filter.name}
        data-azu-active={active || undefined}
      >
        {/* A real space, so the name matches what's shown: "Status Published" */}
        <span>{filter.label}</span> {shown && <span className="azu-filter-value">{shown}</span>}
        <ChevronDownIcon />
      </Button>
      <Popover className="azu-popover azu-filter-popover" placement="bottom start">
        <Dialog className="azu-filter-dialog" aria-label={`Filter by ${filter.label}`}>
          {({ close }) => (
            <>
              <FilterControl
                filter={filter}
                value={value}
                onChange={(next) => {
                  onChange(next)
                  // A date range takes two picks; the rest are done after one
                  if (filter.kind !== 'dateRange') close()
                }}
              />
              {active && (
                <button
                  type="button"
                  className="azu-link-button"
                  onClick={() => {
                    onChange(null)
                    close()
                  }}
                >
                  Clear {filter.label.toLowerCase()}
                </button>
              )}
            </>
          )}
        </Dialog>
      </Popover>
    </DialogTrigger>
  )
}

/**
 * The list's filters (FR-13), each a URL parameter: a button per filter
 * (tinted when on) and Clear filters; below 768px, one "Filters · n"
 * button opening them all in a sheet. A change replaces the filter
 * values; the page goes back to page 1 and keeps the search and sort.
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
  const control = (filter: ListFilter) => ({
    filter,
    value: props.values[filter.name] ?? null,
    onChange: set(filter.name),
  })

  return (
    <>
      <div className="azu-filters" role="group" aria-label={`Filter ${props.label.toLowerCase()}`}>
        {props.filters.map((filter) => (
          <FilterButton key={filter.name} {...control(filter)} />
        ))}
        {active > 0 && (
          <button type="button" className="azu-ghost-button" onClick={() => props.onChange({})}>
            Clear filters
          </button>
        )}
      </div>
      <DialogTrigger>
        <Button
          className="azu-filter-button azu-filters-sheet-button"
          data-azu-active={active > 0 || undefined}
        >
          <FiltersIcon />
          Filters{active > 0 ? ` · ${active}` : ''}
        </Button>
        <ModalOverlay isDismissable className="azu-sheet-overlay">
          <Modal className="azu-sheet">
            <Dialog className="azu-sheet-dialog" aria-label={`Filter ${props.label.toLowerCase()}`}>
              {({ close }) => (
                <>
                  <div className="azu-sheet-header">
                    <h2 className="azu-sheet-title">Filters</h2>
                    {active > 0 && (
                      <button
                        type="button"
                        className="azu-ghost-button"
                        onClick={() => props.onChange({})}
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                  <div className="azu-sheet-body">
                    {props.filters.map((filter) => (
                      <FilterControl key={filter.name} {...control(filter)} />
                    ))}
                  </div>
                  <button
                    type="button"
                    className="azu-button azu-button-primary azu-sheet-done"
                    onClick={close}
                  >
                    Done
                  </button>
                </>
              )}
            </Dialog>
          </Modal>
        </ModalOverlay>
      </DialogTrigger>
    </>
  )
}
