/**
 * Public types for Azu. Front-end packages (`@mezielabs/azu-react`, and
 * later `@mezielabs/azu-vue`) re-export these; they don't define their own.
 */
import type { NavigationGroup, ResourceSchema } from './schema.ts'

export type * from './schema.ts'

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

  /**
   * Resource discovery. Files in `autoload` load at boot; set it to
   * `false` and register resources in `start/admin.ts` instead.
   *
   * @default { autoload: 'app/admin/resources' }
   */
  resources?: { autoload?: string | false }
}

/**
 * The config object `defineConfig` returns, with defaults applied.
 * `guard` stays undefined to mean the app's default guard.
 */
export type AzuConfig = Required<Omit<AzuConfigInput, 'guard' | 'resources'>> & {
  guard?: string
  resources: { autoload: string | false }
}

/**
 * Props shared with every admin page.
 */
export type AzuSharedProps = {
  azu: {
    /** The admin URL prefix, e.g. `/admin` */
    path: string
    /** Resources the user may list, grouped */
    navigation: NavigationGroup[]
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
/**
 * Props for the `azu/resource/index` page. FR-05 adds the records.
 */
export type ResourceIndexPageProps = AzuSharedProps & { resource: ResourceSchema }

/**
 * Props for the `azu/errors/not_found` page.
 */
export type NotFoundPageProps = AzuSharedProps

export interface AzuPages {
  'azu/dashboard': DashboardPageProps
  'azu/resource/index': ResourceIndexPageProps
  'azu/errors/forbidden': ForbiddenPageProps
  'azu/errors/not_found': NotFoundPageProps
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
