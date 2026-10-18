import { Button, Menu, MenuItem, MenuTrigger, Popover, Separator } from 'react-aria-components'
import type { ActionSchema } from '@mezielabs/azu/types'
import { ChevronDownIcon, MoreIcon } from '../shell_icons.tsx'

const cx = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(' ')

/**
 * A row's menu (FR-12, follow-up to layout 2/4): View and Edit, when the
 * server says the user passes the policy's `view` and `update` for this
 * record, then a separator, then the row actions the user may run on it,
 * destructive ones last. Nothing at all when none of those is available.
 */
export function RowActionsMenu(props: {
  actions: ActionSchema[]
  /** The row's title, for the button's accessible name */
  title: string
  /** The detail page, when the user may view the record */
  viewHref?: string
  /** The edit form, when the user may update the record */
  editHref?: string
  /** The button's accessible name; defaults to "Actions for <title>" */
  label?: string
  /** The button's class: borderless in the list, 44px on a phone card */
  className?: string
  onAction: (action: ActionSchema) => void
}) {
  const ordered = [
    ...props.actions.filter((action) => !action.destructive),
    ...props.actions.filter((action) => action.destructive),
  ]
  const links = [
    props.viewHref && { id: '__view', label: 'View', href: props.viewHref },
    props.editHref && { id: '__edit', label: 'Edit', href: props.editHref },
  ].filter((link): link is { id: string; label: string; href: string } => Boolean(link))
  if (links.length === 0 && ordered.length === 0) return null

  const item = ({ isFocused }: { isFocused: boolean }) =>
    cx('azu-menu-item', isFocused && 'azu-is-focused')
  return (
    <MenuTrigger>
      <Button
        className={props.className ?? 'azu-icon-button azu-row-actions-button'}
        aria-label={props.label ?? `Actions for ${props.title}`}
      >
        <MoreIcon />
      </Button>
      <Popover className="azu-popover" placement="bottom end">
        <Menu
          className="azu-menu"
          onAction={(key) => {
            const action = ordered.find((candidate) => candidate.name === key)
            if (action) props.onAction(action)
          }}
        >
          {links.map((link) => (
            // React Aria follows the href through Inertia (the app's RouterProvider)
            <MenuItem key={link.id} id={link.id} href={link.href} className={item}>
              {link.label}
            </MenuItem>
          ))}
          {links.length > 0 && ordered.length > 0 && <Separator className="azu-menu-separator" />}
          {ordered.map((action) => (
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

/**
 * Actions behind a labelled button, as a menu: the bulk bar's "More" or
 * "Actions". Destructive ones are styled as such, and come in the order
 * given.
 */
export function ActionsMenu(props: {
  actions: ActionSchema[]
  label: string
  className?: string
  isDisabled?: boolean
  onAction: (action: ActionSchema) => void
}) {
  if (props.actions.length === 0) return null
  return (
    <MenuTrigger>
      <Button className={props.className} isDisabled={props.isDisabled}>
        {props.label}
        <ChevronDownIcon />
      </Button>
      <Popover className="azu-popover" placement="bottom end">
        <Menu
          className="azu-menu"
          aria-label={props.label}
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
