import { usePage } from '@inertiajs/react'
import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import type { AzuSharedProps } from '@mezielabs/azu/types'
import { MenuIcon } from './shell_icons.tsx'
import { Brand, SidebarContent } from './sidebar.tsx'

const MenuDrawer = lazy(async () => ({
  default: (await import('./menu_drawer.tsx')).MenuDrawer,
}))

export type AdminLayoutProps = AzuSharedProps & {
  /**
   * The page's name. Pages show it in their `PageHeader`; the shell no
   * longer has a top bar to show it in, so this is optional and unused
   */
  title?: string
  children: ReactNode
}

/**
 * The admin shell: a sidebar with the brand, the navigation, and at the
 * bottom "View site", the signed-in user, the theme toggle and sign out;
 * then the page. Below 768px the sidebar becomes a drawer, opened from a
 * top bar's menu button.
 */
export function AdminLayout({ azu, children }: AdminLayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuLoaded, setMenuLoaded] = useState(false)
  const { url } = usePage()

  // A visit from the menu closes it
  useEffect(() => setMenuOpen(false), [url])

  return (
    <div className="azu-shell">
      <a href="#azu-main" className="azu-skip-link">
        Skip to content
      </a>
      <header className="azu-topbar">
        <button
          type="button"
          className="azu-icon-button azu-touch"
          aria-label="Open menu"
          aria-expanded={menuOpen}
          onClick={() => {
            setMenuLoaded(true)
            setMenuOpen(true)
          }}
        >
          <MenuIcon />
        </button>
        <Brand azu={azu} />
      </header>
      <aside className="azu-sidebar" aria-label="Sidebar">
        <SidebarContent azu={azu} variant="rail" />
      </aside>
      {menuLoaded && (
        <Suspense fallback={null}>
          <MenuDrawer azu={azu} isOpen={menuOpen} onOpenChange={setMenuOpen} />
        </Suspense>
      )}
      <main id="azu-main" className="azu-main" tabIndex={-1}>
        <div className="azu-page">{children}</div>
      </main>
    </div>
  )
}
