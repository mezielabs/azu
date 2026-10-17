import { Link } from '@inertiajs/react'
import type { ReactNode } from 'react'

export type Breadcrumb = { label: string; href?: string }

/**
 * Every page's header: a breadcrumb, the title, and the page's actions
 * on the right. `page` and `resource` mark the title for tests and app
 * styles (`data-azu-page`, `data-azu-resource`).
 */
export function PageHeader(props: {
  title: ReactNode
  page: string
  resource?: string
  breadcrumbs?: Breadcrumb[]
  actions?: ReactNode
}) {
  const crumbs = props.breadcrumbs ?? []
  return (
    <header className="azu-page-header">
      <div className="azu-page-heading">
        {crumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="azu-breadcrumbs">
            <ol>
              {crumbs.map((crumb, index) => (
                <li key={`${index}-${crumb.label}`}>
                  {crumb.href ? <Link href={crumb.href}>{crumb.label}</Link> : crumb.label}
                </li>
              ))}
            </ol>
          </nav>
        )}
        <h1
          className="azu-page-title"
          data-azu-page={props.page}
          data-azu-resource={props.resource}
        >
          {props.title}
        </h1>
      </div>
      {props.actions && <div className="azu-page-actions">{props.actions}</div>}
    </header>
  )
}
