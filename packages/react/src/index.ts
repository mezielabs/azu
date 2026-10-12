/**
 * Public entry for `@mezielabs/azu-react`.
 *
 * Package pages import shared pieces from here, never by relative path,
 * so a page copied into an app by `admin:publish` compiles there
 * unchanged. `Head` and `Link` are re-exported for the same reason: the
 * AdonisJS lint config rejects `Link` from `@inertiajs/react` in apps.
 */
export { Head, Link } from '@inertiajs/react'
export { createAzuApp, type CreateAzuAppOptions } from './app.tsx'
export { AdminLayout, type AdminLayoutProps } from './components/admin_layout.tsx'
export { useComponent } from './components/registry.tsx'

/**
 * Contracts are defined in `@mezielabs/azu`, so a future Vue package
 * shares them.
 */
export type {
  FieldProps,
  DashboardPageProps,
  ResourceIndexPageProps,
  ForbiddenPageProps,
  NotFoundPageProps,
  AzuSharedProps,
  NavigationGroup,
  NavigationItem,
  ResourceSchema,
  ColumnSchema,
  FieldSchema,
  FilterSchema,
  ActionSchema,
} from '@mezielabs/azu/types'
