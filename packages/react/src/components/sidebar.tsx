import { Link, router, usePage } from '@inertiajs/react'
import type { AzuSharedProps, NavigationGroup } from '@mezielabs/azu/types'
import { initials } from '@mezielabs/azu/shared'
import icons from '@mezielabs/azu-react/icons'
import { DashboardIcon, ExternalIcon, SignOutIcon } from './shell_icons.tsx'
import { ThemeToggle } from './theme_toggle.tsx'

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

function isCurrent(url: string, href: string) {
  return url === href || url.startsWith(`${href}/`) || url.startsWith(`${href}?`)
}

/**
 * The brand from config/admin.ts: the logo, or a tile with the name's
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
 * The dashboard, then the resources the user may list, in groups. The
 * server builds the list, checking each resource's policy.
 */
function Navigation({ azu }: { azu: Azu }) {
  const { url } = usePage()
  const path = url.split('?')[0]
  return (
    <nav className="azu-nav" aria-label="Admin">
      <ul className="azu-nav-list">
        <li>
          <Link
            href={azu.path}
            className="azu-nav-link"
            aria-current={path === azu.path || path === `${azu.path}/` ? 'page' : undefined}
          >
            <DashboardIcon />
            Dashboard
          </Link>
        </li>
      </ul>
      {azu.navigation.map((group: NavigationGroup) => (
        <div key={group.label ?? ''} className="azu-nav-group">
          {group.label && <p className="azu-nav-heading">{group.label}</p>}
          <ul className="azu-nav-list">
            {group.items.map((item) => (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className="azu-nav-link"
                  aria-current={isCurrent(url, item.href) ? 'page' : undefined}
                  data-azu-icon={item.icon ?? undefined}
                >
                  <NavIcon name={item.icon} />
                  {item.label}
                </Link>
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

function signOut(azu: Azu) {
  router.post(`${azu.path}/logout`)
}

/**
 * The sidebar's contents (FR-14 shell): the brand, the navigation, and
 * at the bottom "View site", the signed-in user, the theme toggle and
 * sign out. `rail` is the sidebar beside the page; `drawer` is the phone
 * menu, with full-width 44px rows.
 */
export function SidebarContent({ azu, variant }: { azu: Azu; variant: 'rail' | 'drawer' }) {
  const signedIn = azu.user !== null
  if (variant === 'drawer') {
    return (
      <>
        <Navigation azu={azu} />
        <div className="azu-sidebar-footer">
          <UserCard azu={azu} />
          <ThemeToggle variant="row" />
          <a href="/" className="azu-sidebar-row">
            <ExternalIcon />
            View site
          </a>
          {signedIn && (
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
        <a href="/" className="azu-sidebar-row">
          <ExternalIcon />
          View site
        </a>
        <div className="azu-user-row">
          <UserCard azu={azu} />
          <ThemeToggle />
          {signedIn && (
            <button
              type="button"
              className="azu-icon-button"
              aria-label="Sign out"
              onClick={() => signOut(azu)}
            >
              <SignOutIcon />
            </button>
          )}
        </div>
      </div>
    </>
  )
}
