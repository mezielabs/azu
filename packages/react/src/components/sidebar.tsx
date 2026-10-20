import { Link, usePage } from '@inertiajs/react'
import type { AzuSharedProps, NavigationGroup, NavigationItem } from '@mezielabs/azu/types'
import { currentNavigationItem, initials, navigationKey } from '@mezielabs/azu/shared'
import icons from '@mezielabs/azu-react/icons'
import { AccountMenu, signOut, ThemeRadios } from './account_menu.tsx'
import { DashboardIcon, ExternalIcon, SignOutIcon } from './shell_icons.tsx'

type Azu = AzuSharedProps['azu']

/**
 * A resource's icon (FR-16), decorative: the label names the link. No
 * icon when the resource names none, or `lucide-react` has no such icon
 * (the `azu()` plugin warns at build time).
 */
function NavIcon({ name }: { name: string | null }) {
  const Icon = name ? icons[name] : undefined
  return Icon ? <Icon className="azu-nav-icon" aria-hidden /> : null
}

/**
 * The brand from config/azu.ts: the logo, or a tile with the name's
 * first letter, then the name.
 */
export function Brand({ azu }: { azu: Azu }) {
  return (
    <Link href={azu.path} className="azu-brand">
      {/* Decorative: the name next to it is the link's text */}
      {azu.brand.logo ? (
        <img src={azu.brand.logo} alt="" className="azu-logo" />
      ) : (
        <span className="azu-brand-mark" aria-hidden="true">
          {azu.brand.name.trim().charAt(0).toUpperCase()}
        </span>
      )}
      <span className="azu-brand-name">{azu.brand.name}</span>
    </Link>
  )
}

/**
 * One navigation item: an Inertia link for an admin page, a plain link
 * for another page of the app, and for an absolute URL a link that opens
 * in a new tab, with an external-link icon (FR-21).
 */
function NavItemLink({ azu, item, current }: { azu: Azu; item: NavigationItem; current: boolean }) {
  const content = (
    <>
      <NavIcon name={item.icon} />
      <span className="azu-nav-label">{item.label}</span>
    </>
  )
  if (item.external) {
    return (
      <a
        href={item.href}
        className="azu-nav-link"
        target="_blank"
        rel="noopener"
        data-azu-external
        data-azu-icon={item.icon ?? undefined}
      >
        {content}
        <ExternalIcon />
        <span className="azu-visually-hidden"> (opens in a new tab)</span>
      </a>
    )
  }
  const inAdmin = item.href === azu.path || item.href.startsWith(`${azu.path}/`)
  const props = {
    'href': item.href,
    'className': 'azu-nav-link',
    'aria-current': current ? ('page' as const) : undefined,
    'data-azu-icon': item.icon ?? undefined,
  }
  return inAdmin ? <Link {...props}>{content}</Link> : <a {...props}>{content}</a>
}

/**
 * The home link (the home screen, else the welcome page), then the
 * resources, screens and links the user may see, in groups. The server
 * builds the list, checking each policy and ability.
 */
function Navigation({ azu }: { azu: Azu }) {
  const { url } = usePage()
  const path = url.split('?')[0].replace(/\/+$/, '')
  const current = currentNavigationItem(url, azu.navigation)
  const homeScreen = azu.home ? `${azu.path}/screens/${azu.home.name}` : null
  const atHome = path === azu.path || (homeScreen !== null && path === homeScreen)
  return (
    <nav className="azu-nav" aria-label="Admin">
      <ul className="azu-nav-list">
        <li>
          <Link href={azu.path} className="azu-nav-link" aria-current={atHome ? 'page' : undefined}>
            {azu.home?.icon ? <NavIcon name={azu.home.icon} /> : <DashboardIcon />}
            {azu.home?.label ?? 'Dashboard'}
          </Link>
        </li>
      </ul>
      {azu.navigation.map((group: NavigationGroup) => (
        <div key={group.label ?? ''} className="azu-nav-group">
          {group.label && <p className="azu-nav-heading">{group.label}</p>}
          <ul className="azu-nav-list">
            {group.items.map((item) => (
              <li key={navigationKey(item)}>
                <NavItemLink azu={azu} item={item} current={current === navigationKey(item)} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function UserCard({ azu }: { azu: Azu }) {
  if (!azu.user) return null
  const name = azu.user.name ?? azu.user.email
  return (
    <div className="azu-user">
      <span className="azu-avatar" aria-hidden="true">
        {initials(azu.user)}
      </span>
      <span className="azu-user-text">
        <span className="azu-user-name">{name}</span>
        {azu.user.name && azu.user.email && (
          <span className="azu-user-email">{azu.user.email}</span>
        )}
      </span>
    </div>
  )
}

/**
 * "View site", a full page load: the app's site isn't an admin page.
 * Hidden when `siteUrl` in config/azu.ts is `false`.
 */
function SiteLink({ azu }: { azu: Azu }) {
  if (!azu.siteUrl) return null
  return (
    <a href={azu.siteUrl} className="azu-sidebar-row">
      <ExternalIcon />
      View site
    </a>
  )
}

/**
 * The sidebar's contents (FR-14 shell): the brand, the navigation, and
 * at the bottom the account button, whose menu holds the theme, View
 * site and Sign out. `rail` is the sidebar beside the page; `drawer` is
 * the phone menu, with full-width 44px rows instead of a menu.
 */
export function SidebarContent({ azu, variant }: { azu: Azu; variant: 'rail' | 'drawer' }) {
  if (variant === 'drawer') {
    return (
      <>
        <Navigation azu={azu} />
        <div className="azu-sidebar-footer">
          <UserCard azu={azu} />
          <ThemeRadios />
          <SiteLink azu={azu} />
          {azu.user && (
            <button type="button" className="azu-sidebar-row" onClick={() => signOut(azu)}>
              <SignOutIcon />
              Sign out
            </button>
          )}
        </div>
      </>
    )
  }
  return (
    <>
      <div className="azu-sidebar-brand">
        <Brand azu={azu} />
      </div>
      <Navigation azu={azu} />
      <div className="azu-sidebar-footer">
        {azu.user ? <AccountMenu azu={azu} /> : <SiteLink azu={azu} />}
      </div>
    </>
  )
}
