/**
 * SPIKE (Phase 1 UI check). Async belongsTo combobox: React Aria's
 * ComboBox fed by useAsyncList, which aborts the previous request
 * (AbortController) whenever the filter text changes.
 */
import { useState } from 'react'
import {
  Button,
  ComboBox,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  useAsyncList,
  type Key,
} from 'react-aria-components'
import { cx } from './utils.ts'

type Category = { id: number; name: string }

export function CategoryCombobox({ path, delay }: { path: string; delay: number }) {
  const [selected, setSelected] = useState<Key | null>(null)
  const [stats, setStats] = useState({ started: 0, aborted: 0, completed: 0 })

  const list = useAsyncList<Category>({
    async load({ signal, filterText }) {
      setStats((s) => ({ ...s, started: s.started + 1 }))
      signal.addEventListener('abort', () => setStats((s) => ({ ...s, aborted: s.aborted + 1 })))
      const query = new URLSearchParams({ search: filterText ?? '', delay: String(delay) })
      const response = await fetch(`${path}/ui-check/categories?${query}`, {
        signal,
        headers: { accept: 'application/json' },
      })
      const items = (await response.json()) as Category[]
      setStats((s) => ({ ...s, completed: s.completed + 1 }))
      return { items }
    },
  })

  return (
    <div className="azu-check" data-azu-check="combobox">
      <ComboBox
        className="azu-combobox"
        items={list.items}
        inputValue={list.filterText}
        onInputChange={list.setFilterText}
        selectedKey={selected}
        onSelectionChange={(key) => {
          setSelected(key)
          // inputValue is controlled by the async list, so push the label back
          const item = list.items.find((category) => category.id === key)
          if (item) list.setFilterText(item.name)
        }}
        allowsEmptyCollection
      >
        <Label className="azu-label">Category</Label>
        <div className="azu-combobox-field">
          <Input className="azu-input" />
          <Button className="azu-icon-button" aria-label="Show categories">
            ▾
          </Button>
        </div>
        <Popover className="azu-popover">
          <ListBox
            className="azu-listbox"
            renderEmptyState={() => (list.isLoading ? 'Loading…' : 'No matching categories')}
          >
            {(item: Category) => (
              <ListBoxItem
                id={item.id}
                className={({ isFocused, isSelected }) =>
                  cx('azu-option', isFocused && 'azu-is-focused', isSelected && 'azu-is-selected')
                }
              >
                {item.name}
              </ListBoxItem>
            )}
          </ListBox>
        </Popover>
      </ComboBox>
      <p className="azu-check-meta" data-azu-check-result="combobox">
        selected={String(selected)} loading={String(list.isLoading)} started={stats.started}{' '}
        aborted={stats.aborted} completed={stats.completed}
      </p>
    </div>
  )
}
