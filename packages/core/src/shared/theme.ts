/**
 * The light/dark choice (FR-14). The admin follows the OS until the user
 * toggles; the choice is remembered per browser in `localStorage` and
 * set as `data-azu-theme` on `<html>`, which the generated palettes key
 * on. Plain TypeScript, shared by the root view's boot script and the
 * front ends.
 */

export type ThemeChoice = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'azu-theme'
export const THEME_ATTRIBUTE = 'data-azu-theme'

export function storedTheme(value: unknown): ThemeChoice | null {
  return value === 'light' || value === 'dark' ? value : null
}

/** The theme in effect: the stored choice, else the OS's */
export function effectiveTheme(stored: ThemeChoice | null, osDark: boolean): ThemeChoice {
  return stored ?? (osDark ? 'dark' : 'light')
}

/**
 * What to remember after a toggle: the other theme, or nothing when the
 * other theme is what the OS prefers, so the admin follows the OS again.
 */
export function toggledTheme(current: ThemeChoice, osDark: boolean): ThemeChoice | null {
  const next: ThemeChoice = current === 'dark' ? 'light' : 'dark'
  return next === (osDark ? 'dark' : 'light') ? null : next
}

/**
 * The inline script the root view runs before the first paint, so a
 * stored choice never flashes the other theme. Storage can throw (a
 * private window, blocked site data); the OS's theme applies then.
 */
export function themeBootScript(): string {
  return `try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="light"||t==="dark")document.documentElement.setAttribute(${JSON.stringify(THEME_ATTRIBUTE)},t)}catch(e){}`
}

type BrowserGlobals = {
  document?: {
    documentElement: {
      setAttribute(n: string, v: string): void
      removeAttribute(n: string): void
      getAttribute(n: string): string | null
    }
  }
  localStorage?: {
    getItem(k: string): string | null
    setItem(k: string, v: string): void
    removeItem(k: string): void
  }
  matchMedia?: (query: string) => { matches: boolean }
}

const browser = () => globalThis as BrowserGlobals

/** Whether the OS prefers dark. Browser-only; `false` elsewhere */
export function prefersDark(): boolean {
  return browser().matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

/** The choice on `<html>`, as the boot script or a toggle set it */
export function currentChoice(): ThemeChoice | null {
  return storedTheme(browser().document?.documentElement.getAttribute(THEME_ATTRIBUTE))
}

/**
 * Applies and remembers a choice; `null` goes back to following the OS.
 * Browser-only.
 */
export function applyThemeChoice(choice: ThemeChoice | null) {
  const { document, localStorage } = browser()
  if (choice) document?.documentElement.setAttribute(THEME_ATTRIBUTE, choice)
  else document?.documentElement.removeAttribute(THEME_ATTRIBUTE)
  try {
    if (choice) localStorage?.setItem(THEME_STORAGE_KEY, choice)
    else localStorage?.removeItem(THEME_STORAGE_KEY)
  } catch {
    // Storage is blocked: the choice lasts until the page reloads
  }
}
