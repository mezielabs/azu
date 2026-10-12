/**
 * Public types for Azu. Front-end packages (`@mezielabs/azu-react`, and
 * later `@mezielabs/azu-vue`) re-export these; they don't define their own.
 */

/**
 * Options accepted by `defineConfig` in `config/admin.ts`.
 */
export type AzuConfigInput = {
  /**
   * URL prefix the admin panel is mounted at.
   *
   * @default '/admin'
   */
  path?: string

  /**
   * The admin Vite entry, relative to the app root. Must match the
   * `entry` option of the `azu()` Vite plugin.
   *
   * @default 'inertia/admin/app.tsx'
   */
  entry?: string

  /**
   * The app's auth guard that admin routes authenticate with.
   *
   * @default the app's default guard
   */
  guard?: string

  /**
   * Where guests are sent when they open the admin panel.
   *
   * @default '/login'
   */
  loginUrl?: string
}

/**
 * The config object `defineConfig` returns, with defaults applied.
 * `guard` stays undefined to mean the app's default guard.
 */
export type AzuConfig = Required<Omit<AzuConfigInput, 'guard'>> & { guard?: string }

/**
 * Props shared with every admin page.
 */
export type AzuSharedProps = {
  azu: {
    /** The admin URL prefix, e.g. `/admin` */
    path: string
  }
}

/**
 * Props for the `azu/dashboard` page.
 */
export type DashboardPageProps = AzuSharedProps

/**
 * Props for the `azu/errors/forbidden` page, shown with a 403 to
 * signed-in users who fail the `accessAdmin` ability.
 */
export type ForbiddenPageProps = AzuSharedProps

/**
 * Every page Azu renders, keyed by its Inertia page name. Names are
 * snake_case paths under `azu/`, like AdonisJS's own pages.
 */
export interface AzuPages {
  'azu/dashboard': DashboardPageProps
  'azu/errors/forbidden': ForbiddenPageProps
}

/**
 * Props every custom field component receives. Swap a field's component
 * with `field.text('sku').component('SkuInput')`.
 */
export type FieldProps<Value = unknown> = {
  value: Value | null
  onChange: (value: Value | null) => void
  errors: string[]
  field: { name: string; label: string }
  record?: Record<string, unknown>
}
