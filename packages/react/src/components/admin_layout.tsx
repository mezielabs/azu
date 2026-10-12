import { Link } from '@inertiajs/react'
import type { ReactNode } from 'react'
import type { AzuSharedProps } from '@mezielabs/azu/types'

export type AdminLayoutProps = AzuSharedProps & {
  title: string
  children: ReactNode
}

/**
 * The admin shell: header with the panel link, then the page.
 */
export function AdminLayout({ azu, title, children }: AdminLayoutProps) {
  return (
    <div className="azu-shell">
      <header className="azu-header">
        <Link href={azu.path} className="azu-brand">
          Azu
        </Link>
        <span className="azu-header-title">{title}</span>
      </header>
      <main className="azu-main">{children}</main>
    </div>
  )
}
