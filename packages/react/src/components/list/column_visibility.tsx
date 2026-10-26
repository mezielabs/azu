import { Button, Dialog, DialogTrigger, Popover } from 'react-aria-components'
import type { ColumnSchema } from '@mezielabs/azu/types'

/** Local presentation choices; the server decides which columns may be supplied. */
export function ColumnVisibility(props: {
  columns: ColumnSchema[]
  visible: string[]
  onChange: (names: string[] | null) => void
}) {
  if (props.columns.length === 0) return null
  return (
    <DialogTrigger>
      <Button className="azu-button azu-columns-button">Columns</Button>
      <Popover className="azu-popover" placement="bottom end">
        <Dialog className="azu-column-options" aria-label="Visible columns">
          <p className="azu-column-heading">Visible columns</p>
          {props.columns.map((column) => {
            const checked = props.visible.includes(column.name)
            return (
              <label className="azu-column-choice" key={column.name}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={checked && props.visible.length === 1}
                  onChange={(event) =>
                    props.onChange(
                      event.target.checked
                        ? [...props.visible, column.name]
                        : props.visible.filter((name) => name !== column.name)
                    )
                  }
                />
                {column.label}
              </label>
            )
          })}
          <button type="button" className="azu-button" onClick={() => props.onChange(null)}>
            Reset to defaults
          </button>
        </Dialog>
      </Popover>
    </DialogTrigger>
  )
}
