import { useRef } from 'react'
import {
  Button,
  ComboBox,
  FieldError,
  Input,
  ListBox,
  ListBoxItem,
  Popover,
  Text,
  useAsyncList,
} from 'react-aria-components'
import type { RelationOption, RelationOptionsResponse, RelationValue } from '@mezielabs/azu/types'
import { FieldLabel, type ControlProps } from './controls.tsx'

const cx = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(' ')

function optionLabel(option: { id: string | number; title: string | null }) {
  return option.title ?? String(option.id)
}

/**
 * Fetches options from the field's policy-checked endpoint. React
 * Aria's `useAsyncList` aborts the previous request whenever the text
 * changes, so the last response wins (docs/ui-check.md §1).
 */
async function fetchOptions(url: string, search: string, signal: AbortSignal) {
  const target = new URL(url, window.location.origin)
  if (search) target.searchParams.set('search', search)
  const response = await fetch(target, {
    signal,
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`Options request failed with ${response.status}`)
  return ((await response.json()) as RelationOptionsResponse).options
}

/**
 * A searchable select for a `belongsTo` field (FR-08). Built from the
 * UI check's findings:
 *
 * - The input is controlled by the list's filter text, and picking an
 *   option writes its label back, so the input never keeps the search.
 * - Optional relations get an explicit Clear button; emptying the text
 *   and leaving the field restores the selection otherwise.
 * - The edit form seeds the current value (id and title), so it shows
 *   without a search. While the input shows the selection, the list
 *   loads unfiltered.
 * - Read-only (set on the field, or because the user can't list the
 *   related resource): the current value, with no options.
 */
export function RelationControl(props: ControlProps) {
  const { field, errors } = props
  const selected = props.value as RelationValue | null
  const current = useRef(selected)
  current.current = selected

  const list = useAsyncList<RelationOption>({
    initialFilterText: selected ? optionLabel(selected) : '',
    async load({ signal, filterText = '' }) {
      if (!field.optionsUrl) return { items: [] }
      const showing = current.current ? optionLabel(current.current) : ''
      const items = await fetchOptions(
        field.optionsUrl,
        filterText === showing ? '' : filterText,
        signal
      )
      return { items }
    },
  })

  // React Aria needs the selected item in the collection to know its label
  const items =
    selected && !list.items.some((item) => item.id === selected.id)
      ? [{ id: selected.id, title: selected.title }, ...list.items]
      : list.items

  function select(key: string | number | null) {
    if (key === null) return
    const option = items.find((item) => item.id === key)
    if (!option) return
    props.onChange({ id: option.id, title: option.title, href: null })
    list.setFilterText(optionLabel(option))
  }

  function clear() {
    props.onChange(null)
    list.setFilterText('')
  }

  return (
    <ComboBox
      name={field.input}
      className="azu-field"
      data-azu-field={field.name}
      isRequired={field.required}
      isInvalid={errors.length > 0}
      isReadOnly={field.readOnly}
      validationBehavior="aria"
      items={items}
      selectedKey={selected?.id ?? null}
      onSelectionChange={(key) => select(key as string | number | null)}
      inputValue={list.filterText}
      onInputChange={list.setFilterText}
      menuTrigger="focus"
      allowsEmptyCollection
    >
      <FieldLabel field={field} />
      <div className="azu-input-group azu-combobox">
        <Input className="azu-input" placeholder={field.placeholder ?? 'Search…'} />
        {!field.required && selected && !field.readOnly && (
          <Button
            className="azu-combobox-button"
            onPress={clear}
            aria-label={`Clear ${field.label}`}
          >
            ×
          </Button>
        )}
        {!field.readOnly && (
          <Button className="azu-combobox-button" aria-label={`Show ${field.label} options`}>
            <span aria-hidden>▾</span>
          </Button>
        )}
      </div>
      {field.help && (
        <Text slot="description" className="azu-description">
          {field.help}
        </Text>
      )}
      <FieldError className="azu-field-error">{errors.join(' ')}</FieldError>
      <Popover className="azu-popover">
        <ListBox<RelationOption>
          className="azu-listbox"
          renderEmptyState={() => (
            <p className="azu-option azu-option-empty">
              {list.isLoading ? 'Loading…' : 'No matches'}
            </p>
          )}
        >
          {(item: RelationOption) => (
            <ListBoxItem
              id={item.id}
              textValue={optionLabel(item)}
              className={({ isFocused, isSelected }) =>
                cx('azu-option', isFocused && 'azu-is-focused', isSelected && 'azu-is-selected')
              }
            >
              {optionLabel(item)}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </ComboBox>
  )
}
