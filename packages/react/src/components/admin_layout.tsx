import { Link, usePage } from '@inertiajs/react'
import type { ReactNode } from 'react'
import type { AzuSharedProps, NavigationGroup } from '@mezielabs/azu/types'
import icons from '@mezielabs/azu-react/icons'
import { ThemeToggle } from './theme_toggle.tsx'

export type AdminLayoutProps = AzuSharedProps & {
  title: string
  children: ReactNode
}

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
 * Resources the user may list, in groups. The server builds the list,
 * checking each resource's policy.
 */
function Navigation({ groups }: { groups: NavigationGroup[] }) {
  const { url } = usePage()
  if (groups.length === 0) return null

  return (
    <nav className="azu-nav" aria-label="Resources">
      {groups.map((group) => (
        <div key={group.label ?? ''} className="azu-nav-group">
          {group.label && <p className="azu-nav-heading">{group.label}</p>}
          <ul className="azu-nav-list">
            {group.items.map((item) => {
              const current =
                url === item.href ||
                url.startsWith(`${item.href}/`) ||
                url.startsWith(`${item.href}?`)
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="azu-nav-link"
                    aria-current={current ? 'page' : undefined}
                    data-azu-icon={item.icon ?? undefined}
                  >
                    <NavIcon name={item.icon} />
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

/**
 * The admin shell: header (the brand from config/admin.ts and the theme
 * toggle), resource navigation, then the page.
 */
export function AdminLayout({ azu, title, children }: AdminLayoutProps) {
  return (
    <div className="azu-shell">
      <header className="azu-header">
        <Link href={azu.path} className="azu-brand">
          {/* Decorative: the name next to it is the link's text */}
          {azu.brand.logo && <img src={azu.brand.logo} alt="" className="azu-logo" />}
          {azu.brand.name}
        </Link>
        <span className="azu-header-title">{title}</span>
        <ThemeToggle />
      </header>
      <div className="azu-body">
        <Navigation groups={azu.navigation} />
        <main className="azu-main">{children}</main>
      </div>
    </div>
  )
}
