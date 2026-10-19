import { router } from '@inertiajs/react'
import { useId, useState, type ReactNode } from 'react'
import {
  Button,
  Header,
  Label,
  Menu,
  MenuItem,
  MenuSection,
  MenuTrigger,
  Popover,
  Radio,
  RadioGroup,
  Separator,
} from 'react-aria-components'
import type { AzuSharedProps } from '@mezielabs/azu/types'
import {
  THEME_SETTINGS,
  applyThemeSetting,
  currentThemeSetting,
  initials,
  type ThemeSetting,
} from '@mezielabs/azu/shared'
import {
  CheckIcon,
  ChevronsUpDownIcon,
  ExternalIcon,
  MonitorIcon,
  MoonIcon,
  SignOutIcon,
  SunIcon,
} from './shell_icons.tsx'

type Azu = AzuSharedProps['azu']

const cx = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(' ')

const THEME_ICONS: Record<ThemeSetting, () => ReactNode> = {
  light: SunIcon,
  dark: MoonIcon,
  system: MonitorIcon,
}

/**
 * The theme setting, applied and remembered as it changes (FR-14)
 */
function useThemeSetting() {
  const [setting, setSetting] = useState<ThemeSetting>(currentThemeSetting)
  return [
    setting,
    (next: ThemeSetting) => {
      applyThemeSetting(next)
      setSetting(next)
    },
  ] as const
}

export function signOut(azu: Azu) {
  router.post(`${azu.path}/logout`)
}

/**
 * The account button at the bottom of the sidebar, and its menu, which
 * opens upward: the user's name and email, the theme (Light, Dark or
 * System), View site (`siteUrl` in config/admin.ts) and Sign out.
 */
export function AccountMenu({ azu }: { azu: Azu }) {
  const [setting, setTheme] = useThemeSetting()
  const emailId = useId()
  if (!azu.user) return null
  const name = azu.user.name ?? azu.user.email ?? 'Account'
  const email = azu.user.name ? azu.user.email : null

  return (
    <MenuTrigger>
      {/* Named from its content, "Account: <name>": the name people see,
          after a hidden prefix. The email, also shown, is its description */}
      <Button className="azu-account" aria-describedby={email ? emailId : undefined}>
        <span className="azu-visually-hidden">Account: </span>
        <span className="azu-avatar" aria-hidden="true">
          {initials(azu.user)}
        </span>
        <span className="azu-user-text">
          <span className="azu-user-name">{name}</span>
          {email && (
            <span id={emailId} className="azu-user-email" aria-hidden="true">
              {email}
            </span>
          )}
        </span>
        <ChevronsUpDownIcon />
      </Button>
      <Popover className="azu-popover azu-account-popover" placement="top start" offset={6}>
        <div className="azu-account-header">
          <p className="azu-account-name">{name}</p>
          {email && <p className="azu-account-email">{email}</p>}
        </div>
        <Menu
          className="azu-menu azu-account-menu"
          aria-label="Account"
          onAction={(key) => key === 'sign-out' && signOut(azu)}
        >
          <MenuSection
            className="azu-menu-section"
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[setting]}
            onSelectionChange={(keys) => {
              const [next] = [...(keys as Set<ThemeSetting>)]
              if (next) setTheme(next)
            }}
          >
            <Header className="azu-menu-heading">Theme</Header>
            {THEME_SETTINGS.map(({ value, label }) => {
              const Icon = THEME_ICONS[value]
              return (
                <MenuItem
                  key={value}
                  id={value}
                  textValue={label}
                  className={({ isFocused }) =>
                    cx('azu-menu-item azu-menu-row', isFocused && 'azu-is-focused')
                  }
                >
                  {({ isSelected }) => (
                    <>
                      <Icon />
                      <span className="azu-menu-label">{label}</span>
                      {isSelected && (
                        <span className="azu-menu-check">
                          <CheckIcon />
                        </span>
                      )}
                    </>
                  )}
                </MenuItem>
              )
            })}
          </MenuSection>
          <Separator className="azu-menu-separator" />
          {azu.siteUrl && (
            <MenuItem
              id="site"
              href={azu.siteUrl}
              // The app's site isn't an admin page: a full page load
              routerOptions={{ document: true }}
              textValue="View site"
              className={({ isFocused }) =>
                cx('azu-menu-item azu-menu-row', isFocused && 'azu-is-focused')
              }
            >
              <ExternalIcon />
              <span className="azu-menu-label">View site</span>
            </MenuItem>
          )}
          <MenuItem
            id="sign-out"
            textValue="Sign out"
            className={({ isFocused }) =>
              cx('azu-menu-item azu-menu-row', isFocused && 'azu-is-focused')
            }
          >
            <SignOutIcon />
            <span className="azu-menu-label">Sign out</span>
          </MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  )
}

/**
 * The phone drawer's theme choice: the same three settings as the
 * account menu, as full-width 44px radio rows.
 */
export function ThemeRadios() {
  const [setting, setTheme] = useThemeSetting()
  return (
    <RadioGroup
      className="azu-theme-radios"
      value={setting}
      onChange={(value) => setTheme(value as ThemeSetting)}
    >
      <Label className="azu-menu-heading">Theme</Label>
      {THEME_SETTINGS.map(({ value, label }) => {
        const Icon = THEME_ICONS[value]
        return (
          <Radio
            key={value}
            value={value}
            className={({ isFocusVisible }) =>
              cx('azu-sidebar-row azu-theme-radio', isFocusVisible && 'azu-is-focused')
            }
          >
            {({ isSelected }) => (
              <>
                <Icon />
                <span className="azu-menu-label">{label}</span>
                {isSelected && (
                  <span className="azu-menu-check">
                    <CheckIcon />
                  </span>
                )}
              </>
            )}
          </Radio>
        )
      })}
    </RadioGroup>
  )
}
