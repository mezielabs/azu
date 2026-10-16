import { useId, useRef } from 'react'
import {
  Button,
  ComboBox,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Tag,
  TagGroup,
  TagList,
  useAsyncList,
} from 'react-aria-components'
import { fetchRelationOptions } from '@mezielabs/azu/shared'
import type { RelationOption, RelationValue } from '@mezielabs/azu/types'
import { FieldLabelText, type ControlProps } from './controls.tsx'

const cx = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(' ')

function optionLabel(option: { id: string | number; title: string | null }) {
  return option.title ?? String(option.id)
}

/**
 * A `manyToMany` field (FR-09): the attached records as removable tags,
 * and a searchable select that adds one at a time, from the field's
 * policy-checked options endpoint (the `belongsTo` field's, with its
 * `viewList` rule). Picking a record adds it and clears the search, so
 * the next can be found straight away. Read-only (set on the field,
 * because the user can't list the related resource, or because more
 * records are attached than the form loads, which it says): the tags
 * alone.
 *
 * The form submits the records' keys under the field's input
 * (`tagIds`).
 */
export function RelationsControl(props: ControlProps) {
  const { field, errors } = props
  const selected = (props.value as RelationValue[] | null) ?? []
  const current = useRef(selected)
  current.current = selected
  const labelId = useId()
  const helpId = useId()
  const reasonId = useId()
  const errorId = useId()
  const describedBy = [
    field.help && helpId,
    field.readOnlyReason && reasonId,
    errors.length > 0 && errorId,
  ]
    .filter(Boolean)
    .join(' ')

  const list = useAsyncList<RelationOption>({
    async load({ signal, filterText = '' }) {
      if (!field.optionsUrl) return { items: [] }
      return { items: await fetchRelationOptions(field.optionsUrl, filterText, signal) }
    },
  })
  // Records already attached aren't offered again
  const taken = new Set(selected.map((item) => item.id))
  const options = list.items.filter((item) => !taken.has(item.id))

  function add(key: string | number | null) {
    const option = options.find((item) => item.id === key)
    if (!option) return
    props.onChange([...current.current, { id: option.id, title: option.title, href: null }])
    list.setFilterText('')
  }

  function remove(keys: Set<string | number>) {
    props.onChange(current.current.filter((item) => !keys.has(item.id)))
  }

  const editable = !field.readOnly && field.optionsUrl !== null

  return (
    <div className="azu-field azu-relations" data-azu-field={field.name}>
      <TagGroup
        className="azu-tag-group"
        aria-labelledby={labelId}
        aria-describedby={describedBy || undefined}
        onRemove={editable ? (keys) => remove(keys as Set<string | number>) : undefined}
      >
        <Label id={labelId} className="azu-label">
          <FieldLabelText field={field} />
        </Label>
        <TagList
          className="azu-tag-list"
          items={selected}
          renderEmptyState={() => <span className="azu-cell-empty">None</span>}
        >
          {(item) => (
            <Tag
              id={item.id}
              textValue={optionLabel(item)}
              className={({ isFocusVisible }) => cx('azu-tag', isFocusVisible && 'azu-is-focused')}
            >
              {optionLabel(item)}
              {editable && (
                // React Aria names it "Remove" plus the tag's own label
                <Button slot="remove" className="azu-tag-remove">
                  <span aria-hidden>×</span>
                </Button>
              )}
            </Tag>
          )}
        </TagList>
      </TagGroup>
      {editable && (
        <ComboBox
          className="azu-relations-add"
          aria-label={`Add ${field.label.toLowerCase()}`}
          items={options}
          selectedKey={null}
          onSelectionChange={(key) => add(key as string | number | null)}
          inputValue={list.filterText}
          onInputChange={list.setFilterText}
          menuTrigger="focus"
          allowsEmptyCollection
        >
          <div className="azu-input-group azu-combobox">
            <Input className="azu-input" placeholder={field.placeholder ?? 'Search to add…'} />
            <Button className="azu-combobox-button" aria-label={`Show ${field.label} options`}>
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
                  className={({ isFocused }) => cx('azu-option', isFocused && 'azu-is-focused')}
                >
                  {optionLabel(item)}
                </ListBoxItem>
              )}
            </ListBox>
          </Popover>
        </ComboBox>
      )}
      {field.help && (
        <p id={helpId} className="azu-description">
          {field.help}
        </p>
      )}
      {field.readOnlyReason && (
        <p id={reasonId} className="azu-description" data-azu-read-only-reason>
          {field.readOnlyReason}
        </p>
      )}
      {errors.length > 0 && (
        <p id={errorId} className="azu-field-error">
          {errors.join(' ')}
        </p>
      )}
    </div>
  )
}
