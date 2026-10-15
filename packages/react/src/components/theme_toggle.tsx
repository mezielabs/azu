import { useEffect, useState } from 'react'
import {
  applyThemeChoice,
  currentChoice,
  effectiveTheme,
  prefersDark,
  toggledTheme,
} from '@mezielabs/azu/shared'

/**
 * Switches between the light and dark themes (FR-14). The admin follows
 * the OS until the user presses it; the choice is remembered in this
 * browser, and toggling back to the OS's theme follows the OS again.
 */
export function ThemeToggle() {
  const [osDark, setOsDark] = useState(prefersDark)
  const [choice, setChoice] = useState(currentChoice)

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => setOsDark(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  const dark = effectiveTheme(choice, osDark) === 'dark'
  return (
    <button
      type="button"
      className="azu-button azu-theme-toggle"
      aria-pressed={dark}
      onClick={() => {
        const next = toggledTheme(dark ? 'dark' : 'light', osDark)
        applyThemeChoice(next)
        setChoice(next)
      }}
    >
      <span aria-hidden>{dark ? '☾' : '☀'}</span> Dark theme
    </button>
  )
}
