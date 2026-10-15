import { useEffect, useRef } from 'react'
import {
  Button,
  ComboBox,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  useAsyncList,
} from 'react-aria-components'
import { fetchRelationOptions } from '@mezielabs/azu/shared'
import type { RelationOption } from '@mezielabs/azu/types'
import type { FilterControlProps } from './filter_bar.tsx'

const cx = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(' ')

function optionLabel(option: RelationOption) {
  return option.title ?? String(option.id)
}

/**
 * A searchable select over the filter's policy-checked options
 * endpoint, like a `belongsTo` field's (docs/ui-check.md §1): the input
 * shows the selection, and only text the user types is searched.
 */
export function RelationFilter({ filter, onChange }: FilterControlProps) {
  const selected = filter.selected
  const current = useRef(selected)
  current.current = selected

  const list = useAsyncList<RelationOption>({
    initialFilterText: selected ? optionLabel(selected) : '',
    async load({ signal, filterText = '' }) {
      if (!filter.optionsUrl) return { items: [] }
      const showing = current.current ? optionLabel(current.current) : ''
      const search = filterText === showing ? '' : filterText
      return { items: await fetchRelationOptions(filter.optionsUrl, search, signal) }
    },
  })

  // Back and forward navigation change the selection under us. Not on
  // mount: the list's first load already shows it
  const selectedId = selected?.id ?? null
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    list.setFilterText(current.current ? optionLabel(current.current) : '')
  }, [selectedId])

  // React Aria needs the selected item in the collection to know its label
  const items =
    selected && !list.items.some((item) => item.id === selected.id)
      ? [selected, ...list.items]
      : list.items

  return (
    <ComboBox
      className="azu-filter"
      data-azu-filter={filter.name}
      items={items}
      selectedKey={selected?.id ?? null}
      onSelectionChange={(key) => {
        if (key === null) return
        const option = items.find((item) => item.id === key)
        if (option) {
          list.setFilterText(optionLabel(option))
          onChange(String(option.id))
        }
      }}
      inputValue={list.filterText}
      onInputChange={list.setFilterText}
      menuTrigger="focus"
      allowsEmptyCollection
    >
      <Label className="azu-filter-label">{filter.label}</Label>
      <div className="azu-input-group azu-combobox">
        <Input className="azu-input" placeholder="All" />
        {selected && (
          <Button
            className="azu-combobox-button"
            aria-label={`Clear ${filter.label}`}
            onPress={() => {
              list.setFilterText('')
              onChange(null)
            }}
          >
            ×
          </Button>
        )}
        <Button className="azu-combobox-button" aria-label={`Show ${filter.label} options`}>
          <span aria-hidden>▾</span>
        </Button>
      </div>
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
