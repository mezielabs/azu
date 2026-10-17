import { useEffect, useState } from 'react'
import {
  applyThemeChoice,
  currentChoice,
  effectiveTheme,
  prefersDark,
  toggledTheme,
} from '@mezielabs/azu/shared'
import { MoonIcon, SunIcon } from './shell_icons.tsx'

/**
 * Switches between the light and dark themes (FR-14). The admin follows
 * the OS until the user presses it; the choice is remembered in this
 * browser, and toggling back to the OS's theme follows the OS again.
 *
 * Labelled by what it does ("Switch to dark theme"): an icon button in
 * the sidebar, a full row with the label in the phone menu.
 */
export function ThemeToggle(props: { variant?: 'icon' | 'row' }) {
  const [osDark, setOsDark] = useState(prefersDark)
  const [choice, setChoice] = useState(currentChoice)

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => setOsDark(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  const dark = effectiveTheme(choice, osDark) === 'dark'
  const label = dark ? 'Switch to light theme' : 'Switch to dark theme'
  const row = props.variant === 'row'
  return (
    <button
      type="button"
      className={row ? 'azu-sidebar-row azu-theme-toggle' : 'azu-icon-button azu-theme-toggle'}
      aria-label={row ? undefined : label}
      data-azu-theme-current={dark ? 'dark' : 'light'}
      onClick={() => {
        const next = toggledTheme(dark ? 'dark' : 'light', osDark)
        applyThemeChoice(next)
        setChoice(next)
      }}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
      {row && label}
    </button>
  )
}
