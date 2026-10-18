import { Button, Menu, MenuItem, MenuTrigger, Popover } from 'react-aria-components'
import type { ActionSchema } from '@mezielabs/azu/types'
import { MoreIcon } from '../shell_icons.tsx'

const cx = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(' ')

/**
 * A row's actions in a menu (FR-12): only the ones the server says
 * the user may run on this record.
 */
export function RowActionsMenu(props: {
  actions: ActionSchema[]
  /** The row's title, for the button's accessible name */
  title: string
  onAction: (action: ActionSchema) => void
}) {
  if (props.actions.length === 0) return null
  return (
    <MenuTrigger>
      <Button
        className="azu-icon-button azu-row-actions-button"
        aria-label={`Actions for ${props.title}`}
      >
        <MoreIcon />
      </Button>
      <Popover className="azu-popover" placement="bottom end">
        <Menu
          className="azu-menu"
          onAction={(key) => {
            const action = props.actions.find((item) => item.name === key)
            if (action) props.onAction(action)
          }}
        >
          {props.actions.map((action) => (
            <MenuItem
              key={action.name}
              id={action.name}
              className={({ isFocused }) =>
                cx(
                  'azu-menu-item',
                  isFocused && 'azu-is-focused',
                  action.destructive && 'azu-is-destructive'
                )
              }
            >
              {action.label}
            </MenuItem>
          ))}
        </Menu>
      </Popover>
    </MenuTrigger>
  )
}
