/**
 * Public types for Azu. Front-end packages (`@mezielabs/azu-react`, and
 * later `@mezielabs/azu-vue`) re-export these; they don't define their own.
 */
import type {
  ActionKey,
  CellValue,
  ColumnSchema,
  FieldSchema,
  FieldValue,
  FormErrors,
  FormFieldSchema,
  ListFilter,
  ListMeta,
  RelationOption,
  RelationTable,
  ListRow,
  NavigationGroup,
  ScreenSchema,
  RecordData,
  ResourceSchema,
} from './schema.ts'
import type { ListState, PageSize } from './shared/list_state.ts'
import type { Screen, ScreenAbility } from './screens/define_screen.ts'

export type * from './schema.ts'
export type { SlotName } from './shared/slots.ts'

/**
 * Options accepted by `defineConfig` in `config/azu.ts`.
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
   * The account menu's "View site" link: your public site, as a path
   * or a full URL. `false` hides the link.
   *
   * @default '/'
   */
  siteUrl?: string | false

  /**
   * Resource discovery. Files in `autoload` load at boot; set it to
   * `false` and register resources in `start/azu.ts` instead.
   *
   * @default { autoload: 'app/admin/resources' }
   */
  resources?: { autoload?: string | false }

  /**
   * Screen discovery (FR-20). Files in `autoload` load at boot, each a
   * `defineScreen()` default export named after its file; set it to
   * `false` and call `azu.registerScreen()` in `start/azu.ts` instead.
   *
   * @default { autoload: 'app/admin/screens' }
   */
  screens?: { autoload?: string | false }

  /**
   * What `<path>/` shows (FR-22): a screen, by name, rendered there
   * with the URL unchanged, or `{ resource }`, which redirects to that
   * resource's list. A user who fails the screen's ability gets the
   * welcome page. Naming no screen or resource is a boot error. Without
   * it, `<path>/` is the welcome page.
   *
   * @example
   * ```ts
   * home: 'overview'
   * home: { resource: 'orders' }
   * ```
   */
  home?: string | { resource: string }

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

  /**
   * Navigation (FR-16). `groups` lists group labels in the order the
   * navigation shows them; groups it leaves out follow, in label order.
   * Resources without a group always come first.
   *
   * @example
   * ```ts
   * navigation: { groups: ['Sales', 'Catalog'] }
   * ```
   * @default { groups: [] }
   */
  navigation?: {
    groups?: string[]
    /**
     * Links in the navigation (FR-21), to any URL: a filtered list, a
     * page of the app, another site. `ability` only hides the link from
     * users who fail it; the page it opens must check access itself.
     * An absolute `http(s)` URL opens in a new tab.
     *
     * @example
     * ```ts
     * links: [{ label: 'Awaiting shipping', url: '/admin/resources/orders?status=paid', group: 'Sales' }]
     * ```
     */
    links?: NavigationLinkInput[]
  }

  /**
   * The admin's name, logo and colour (FR-14). `color` is a hex colour;
   * Azu generates light and dark palettes from it, adjusting it where
   * needed so text stays readable (WCAG AA).
   *
   * @example
   * ```ts
   * brand: { name: 'Acme', logo: '/images/logo.svg', color: '#2563eb' }
   * ```
   * @default { name: 'Admin', color: '#2563eb' }
   */
  brand?: {
    /** Shown in the header and page titles */
    name?: string
    /** An image URL shown before the name in the header */
    logo?: string
    /** A hex colour, `#2563eb` or `#26e` */
    color?: string
  }
}

/**
 * A navigation link (FR-21), as `navigation.links` takes it.
 */
export type NavigationLinkInput = {
  label: string
  /** A path (`/admin/resources/orders?status=paid`) or an absolute URL */
  url: string
  group?: string
  /** Lucide icon name */
  icon?: string
  /** Position within its group: lower first, then by label */
  order?: number
  /** A Bouncer ability object. Hides the link from users who fail it; it doesn't protect the target */
  ability?: ScreenAbility
}

/**
 * The brand with defaults applied.
 */
export type AzuBrand = { name: string; logo: string | null; color: string }

/**
 * The config object `defineConfig` returns, with defaults applied.
 * `guard` stays undefined to mean the app's default guard.
 */
export type AzuConfig = Required<
  Omit<
    AzuConfigInput,
    'guard' | 'resources' | 'screens' | 'home' | 'defaultDisk' | 'brand' | 'navigation'
  >
> & {
  navigation: { groups: string[]; links: NavigationLinkInput[] }
  screens: { autoload: string | false }
  /** `null` means the welcome page */
  home: string | { resource: string } | null
  guard?: string
  /** `undefined` means Drive's default disk */
  defaultDisk?: string
  resources: { autoload: string | false }
  brand: AzuBrand
}

/**
 * The signed-in user, as the sidebar shows them: `fullName`, else
 * `name`, and `email`, whichever their model has.
 */
export type AzuUser = { name: string | null; email: string | null }

/**
 * Props shared with every admin page.
 */
export type AzuSharedProps = {
  azu: {
    /** The admin URL prefix, e.g. `/admin` */
    path: string
    /** Resources the user may list, grouped */
    navigation: NavigationGroup[]
    /** The admin's timezone (`timezone` in config/azu.ts), for dates */
    timezone: string
    /** The admin's name and logo (`brand` in config/azu.ts) */
    brand: { name: string; logo: string | null }
    /** The signed-in user; `null` when there's none */
    user: AzuUser | null
    /** The "View site" link (`siteUrl` in config/azu.ts); `null` hides it */
    siteUrl: string | null
    /**
     * The home screen (`home` in config/azu.ts, FR-22), when the user
     * may open it: the navigation's first link takes its label and icon.
     * `null` means the welcome page, "Dashboard".
     */
    home: { name: string; label: string; icon: string | null } | null
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
    /** The filters this user may use, with their values */
    filters: ListFilter[]
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
  /**
   * The record "Create & add another" just created, for the fresh
   * form's toast and its View link; `null` otherwise
   */
  saved: { id: string | number; title: string | null } | null
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
  /**
   * The record's `createdAt` and `updatedAt`, as ISO strings, for the
   * page's Record card; each `null` when the model has no such column or
   * no value
   */
  timestamps: { createdAt: string | null; updatedAt: string | null }
  /**
   * The record's column values, as the list shows them, when the user
   * may see none of its fields: the page shows the columns instead.
   * `null` when there are fields
   */
  cells: Record<string, CellValue> | null
  /** `hasMany` fields whose related resource the user may list */
  relations: RelationTable[]
  /** What the user may do with this record, from the policy */
  abilities: {
    update: boolean
    /** Row actions the user may run on this record (`row.publish`, `row.delete`) */
    actions: ActionKey[]
  }
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
 * Props for the `azu/screen` page (FR-20): the screen, and what its
 * `data` function returned (`null` without one).
 */
export type ScreenPageProps = AzuSharedProps & {
  screen: ScreenSchema
  data: unknown
}

/**
 * Props a screen's component receives (FR-20): its `data`, typed from
 * the screen's `data` function, and the screen.
 *
 * @example
 * ```tsx
 * import type { ScreenProps } from '@mezielabs/azu-react'
 * import type salesReport from '#admin/screens/sales_report'
 *
 * export default function SalesReport({ data }: ScreenProps<typeof salesReport>) {}
 * ```
 */
export type ScreenProps<S extends Screen<any> = Screen<unknown>> = {
  data: S['__data']
  screen: ScreenSchema
}

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
  'azu/screen': ScreenPageProps
}

/**
 * Props a custom list cell receives: `column.custom('stock', 'StockBar')`,
 * or `.component('Name')` on any column (FR-15).
 */
export type CellProps<Value = unknown> = {
  /** The cell's value, as the column kind serialises it */
  value: Value | null
  /** The row: its id, title, every cell's value, and what the user may do with it */
  record: ListRow
  column: ColumnSchema
}

/**
 * Props a slot component receives (FR-15): which resource and page it's
 * on, and the record on the edit and detail pages.
 */
export type SlotProps = {
  resource: ResourceSchema
  page: 'index' | 'create' | 'edit' | 'show'
  /** The record being edited or shown; `null` on the list and create pages */
  record: { id: string | number; title: string | null } | null
  /** The resource's list URL, e.g. `/admin/resources/products` */
  path: string
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
