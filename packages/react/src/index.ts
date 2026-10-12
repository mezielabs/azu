/**
 * Public entry for `@mezielabs/azu-react`.
 *
 * Package pages import shared pieces from here (not by relative path), so a
 * page copied into an app by `admin:publish` compiles there unchanged.
 */
/**
 * Re-exported so published pages import only from this package and pass
 * the app's lint rules (AdonisJS flags `Link` from `@inertiajs/react`).
 */
export { Head, Link } from '@inertiajs/react'
export { createAzuApp, type CreateAzuAppOptions } from './app.tsx'
export { AdminLayout } from './components/admin_layout.tsx'
export { useComponent, type FieldProps } from './components/registry.tsx'
