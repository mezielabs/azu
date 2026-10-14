/**
 * Public types for Azu. Front-end packages (`@mezielabs/azu-react`, and
 * later `@mezielabs/azu-vue`) re-export these; they don't define their own.
 */
import type {
  FieldSchema,
  FieldValue,
  FormErrors,
  FormFieldSchema,
  ListMeta,
  RelationOption,
  RelationTable,
  ListRow,
  NavigationGroup,
  RecordData,
  ResourceSchema,
} from './schema.ts'
import type { ListState, PageSize } from './shared/list_state.ts'

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

  /**
   * Rows per list page when the URL doesn't say: 10, 25, 50 or 100.
   *
   * @default 25
   */
  perPage?: PageSize

  /**
   * The Drive disk `file` and `image` fields store uploads on, unless a
   * field sets `disk()`.
   *
   * @default Drive's default disk
   */
  defaultDisk?: string

  /**
   * The timezone admins enter and read dates in, as an IANA name such
   * as `'Africa/Lagos'`. Set it when it differs from the server
   * process's timezone (`TZ`), for example with the server in UTC.
   *
   * @default the server process's timezone
   */
  timezone?: string
}

/**
 * The config object `defineConfig` returns, with defaults applied.
 * `guard` stays undefined to mean the app's default guard.
 */
export type AzuConfig = Required<Omit<AzuConfigInput, 'guard' | 'resources' | 'defaultDisk'>> & {
  guard?: string
  /** `undefined` means Drive's default disk */
  defaultDisk?: string
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
    /** The admin's timezone (`timezone` in config/admin.ts), for dates */
    timezone: string
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
 * Props for the `azu/resource/index` page: the schema, one page of
 * rows, and the URL state that produced it.
 */
export type ResourceIndexPageProps = AzuSharedProps & {
  resource: ResourceSchema
  list: {
    rows: ListRow[]
    meta: ListMeta
    state: ListState
    /** The page size the URL leaves out */
    defaultPerPage: PageSize
  }
  /** What the user may do on this resource, from the policy */
  abilities: { create: boolean }
}

/**
 * The form both `azu/resource/create` and `azu/resource/edit` render:
 * the fields this user may edit, their starting values, and the
 * validation errors from the last submit.
 */
export type ResourceFormData = {
  fields: FormFieldSchema[]
  /** Keyed by field name */
  values: Record<string, FieldValue>
}

/**
 * Props for the `azu/resource/create` page. A failed submit renders it
 * again with a 422 and `errors`.
 */
export type ResourceCreatePageProps = AzuSharedProps & {
  resource: ResourceSchema
  form: ResourceFormData
  errors: FormErrors
}

/**
 * Props for the `azu/resource/edit` page. A failed submit renders it
 * again with a 422 and `errors`.
 */
export type ResourceEditPageProps = AzuSharedProps & {
  resource: ResourceSchema
  record: Omit<RecordData, 'values'>
  form: ResourceFormData
  errors: FormErrors
}

/**
 * Props for the `azu/resource/show` page: the record's fields, read-only.
 */
export type ResourceShowPageProps = AzuSharedProps & {
  resource: ResourceSchema
  /** The fields this user may see */
  fields: FieldSchema[]
  record: RecordData
  /** `hasMany` fields whose related resource the user may list */
  relations: RelationTable[]
  /** What the user may do with this record, from the policy */
  abilities: { update: boolean }
}

/**
 * The JSON a `belongsTo` field's `optionsUrl` returns.
 */
export type RelationOptionsResponse = { options: RelationOption[] }

/**
 * Props for the `azu/errors/not_found` page.
 */
export type NotFoundPageProps = AzuSharedProps

/**
 * Every page Azu renders, keyed by its Inertia page name. Names are
 * snake_case paths under `azu/`, like AdonisJS's own pages.
 */
export interface AzuPages {
  'azu/dashboard': DashboardPageProps
  'azu/resource/index': ResourceIndexPageProps
  'azu/resource/create': ResourceCreatePageProps
  'azu/resource/edit': ResourceEditPageProps
  'azu/resource/show': ResourceShowPageProps
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
