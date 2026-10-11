# Azu engineering spec

Condensed from the Azu PRD & Product Spec (Oct 2026) for implementation. The PRD's business sections (personas, pricing, metrics) are left out. Where this file and `README.md` disagree, raise it before choosing one.

Azu is an Inertia-first admin panel for AdonisJS 7. It reads the app's existing Lucid models, Bouncer policies, VineJS validators, and Drive disks, so a full CRUD back office takes minutes. Free MIT core (`@mezielabs/azu`), paid Pro extensions later.

---

## 1. v1 requirements

P0 is required for v1.0. P1 ships in v1.0 if the schedule holds, otherwise v1.1. P2 waits for user demand.

| ID | Requirement | Acceptance criteria | Priority |
| --- | --- | --- | --- |
| FR-01 | Install with `node ace add @mezielabs/azu` | On a fresh AdonisJS 7 Inertia + React starter, `/admin` loads with no manual file edits | P0 |
| FR-02 | Access gate on the app's existing auth guard | Guests redirect to the app's login; signed-in users failing the `accessAdmin` ability get a 403 | P0 |
| FR-03 | Resource classes in `app/admin/resources` | A resource declaring a model, columns, and fields appears in navigation with no registration step | P0 |
| FR-04 | Generator `make:admin-resource` | Output for any Lucid model compiles and renders list and forms with zero edits | P0 |
| FR-05 | List screen: pagination, sorting, search | Server-side; page sizes 10/25/50/100; sort, search, and page survive reload via the URL | P0 |
| FR-06 | Create, edit, and detail screens | Save redirects to detail with a success toast; unsaved-changes warning on navigate away | P0 |
| FR-07 | Core field types | text, textarea, number, boolean, select, date, datetime, richText, file, image (via Drive) | P0 |
| FR-08 | belongsTo and hasMany | belongsTo renders a searchable async select; hasMany renders a paginated table on detail | P0 |
| FR-09 | manyToMany picker | Attach and detach related records from the form with search | P1 |
| FR-10 | VineJS validation reuse | Create and update use the validators named on the resource; 422 errors render under each field | P0 |
| FR-11 | Bouncer permissions | Every screen, field, and action checks the resource policy server-side; disallowed UI is hidden | P0 |
| FR-12 | Row and bulk actions | Run on one or selected rows, with confirm dialog and result toast; failures roll back | P0 |
| FR-13 | Filters | select, boolean, and dateRange filters plus custom query filters, all encoded in the URL | P0 |
| FR-14 | Theming | Light and dark mode; brand colour, logo, and app name from `config/admin.ts` | P0 |
| FR-15 | Component overrides | Any field component can be swapped per resource; `node ace admin:publish` copies pages for editing | P1 |
| FR-16 | Navigation groups | Resources grouped, ordered, and given icons from the resource definition | P1 |
| FR-17 | Bulk action on all filtered rows | "Select all N matching" runs the action in chunks of 500 | P1 |
| FR-18 | Soft deletes | Trashed filter and restore action when the model uses soft deletes | P2 |
| FR-19 | Global search | Cmd/Ctrl+K palette searches every resource's title column | P2 |

**Out of scope for v1:** Vue or Svelte front ends, a visual no-code builder, ORMs other than Lucid, AdonisJS versions before 7, a plugin marketplace, replacing the app's auth, and all Pro features (dashboards, audit log, CSV import/export, impersonation, multi-tenancy, premium theme).

**Pro boundary:** Pro ships later as separate packages that plug into public core extension points. Design those extension points, but never import Pro code from core.

## 2. Non-functional requirements

| Area | Requirement |
| --- | --- |
| Performance | List page server response under 200 ms at p95 for 100,000 rows, 25 per page, on Postgres with indexed sort columns. No N+1: relations shown in columns are preloaded. |
| Security | Every admin route and action authorises server-side, never only by hiding UI. CSRF on all writes. Mass assignment limited to declared fields. Uploads restricted by MIME type and size per field. |
| Accessibility | WCAG 2.1 AA on core screens: keyboard navigation, focus states, labelled inputs, 4.5:1 contrast in both themes. |
| Compatibility | AdonisJS 7, Node 22+, Inertia with React 19, Lucid on Postgres, MySQL, and SQLite. Latest two versions of Chrome, Firefox, Safari, Edge. |
| Type safety | Resource definitions typed against the model: a misspelled column or field name fails `tsc`. |
| Bundle | Admin JS loads only on `/admin` routes via a separate Vite entry; zero added weight on public pages. |
| Upgrades | Semver. Published components carry a version stamp; `admin:doctor` flags drift. |
| i18n | All UI strings go through AdonisJS i18n; English only in v1. |
| Mobile | Usable at 375 px: tables scroll horizontally, forms stack. |

## 3. Architecture

Generic controllers read a resource definition, and the resource definition points at code the app already has. Nothing about permissions or validity is defined twice.

Request flow:

1. Request hits a route under `/admin` (path from config).
2. Middleware authenticates with the configured guard (redirect to `loginUrl` if guest), then checks the `accessAdmin` ability (403 if denied).
3. A generic resource controller resolves the resource definition from the registry.
4. It checks the resource's Bouncer policy for the operation.
5. It queries the Lucid model (applying the resource's `query` hook, search, sort, filters, pagination) or validates and writes through the named VineJS validator.
6. It renders an Inertia page with typed props: resource schema (columns, fields, filters, actions), the data page or record, and the user's computed abilities.

## 4. Resource definition API

```ts
// app/admin/resources/product_resource.ts
import { defineResource, column, field, filter, action } from '@mezielabs/azu'
import Product from '#models/product'
import ProductPolicy from '#policies/product_policy'
import { createProductValidator, updateProductValidator } from '#validators/product'

export default defineResource(Product, {
  label: 'Products',
  group: 'Catalog',
  icon: 'package',
  title: 'name',
  search: ['name', 'sku'],
  policy: ProductPolicy,
  validators: { create: createProductValidator, update: updateProductValidator },
  query: (q) => q.preload('category'),

  columns: [
    column.image('thumbnail'),
    column.text('name').sortable(),
    column.text('sku'),
    column.number('price').format('currency', 'NGN').sortable(),
    column.belongsTo('category', 'name'),
    column.badge('status').colors({ draft: 'gray', published: 'green' }),
    column.datetime('createdAt').sortable().hiddenByDefault(),
  ],

  fields: [
    field.text('name'),
    field.text('sku'),
    field.number('price').min(0),
    field.belongsTo('category').searchable('name'),
    field.select('status').options({ draft: 'Draft', published: 'Published' }),
    field.richText('description'),
    field.image('thumbnail').disk('s3').maxSize('2mb'),
    field.manyToMany('tags').searchable('name'),
  ],

  filters: [
    filter.select('status', { draft: 'Draft', published: 'Published' }),
    filter.belongsTo('category'),
    filter.dateRange('createdAt'),
    filter.custom('Low stock', (q) => q.where('stock', '<', 10)),
  ],

  actions: [
    action.bulk('publish')
      .confirm('Publish the selected products?')
      .ability('publish')
      .handle(async (products) => {
        await Product.query().whereIn('id', products.map((p) => p.id)).update({ status: 'published' })
        return { message: `${products.length} products published` }
      }),
  ],
})
```

Rules:

- **Typed against the model.** `defineResource(Model, …)` infers attribute and relation names; `column.text('nmae')` fails `tsc`.
- **Required comes from the validator.** Fields have no `required()`. The form reads required, maxLength, and min/max hints from the VineJS schema where it can.
- **Discovery by convention.** Files in `app/admin/resources` load at boot. `start/admin.ts` can register resources explicitly when autoload is off.
- **Hooks.** `beforeSave`, `afterSave`, `beforeDelete` receive the model instance and the HTTP context.
- **Defaults.** Omitting `columns` or `fields` falls back to what the generator would produce.

## 5. Fields, columns, filters, actions

| Type | Form control | List column | Storage |
| --- | --- | --- | --- |
| `text` | Input, optional prefix/suffix | Text, truncated at 60 chars | String |
| `textarea` | Auto-growing textarea | Hidden by default | Text |
| `number` | Numeric input with min, max, step | Number, optional currency/percent format | Integer or decimal |
| `boolean` | Toggle | Check or cross icon | Boolean |
| `select` | Dropdown, radios when 4 or fewer options | Badge with optional colours | String or enum |
| `date`, `datetime` | Date picker in the app's timezone | Formatted, relative on hover | Luxon `DateTime` |
| `richText` | Tiptap editor, output sanitised | Hidden by default | HTML in text column |
| `file`, `image` | Drag-and-drop upload with preview | File name or thumbnail | Drive disk, key on the model |
| `belongsTo` | Searchable async select | Related title, linked | Foreign key |
| `hasMany` | Paginated table on detail page | Count | Lucid relation |
| `manyToMany` | Searchable picker | Count | Lucid relation |

Every field supports `label`, `help`, `placeholder`, `default`, `visibleOn('create' | 'edit')`, `readOnly`, `ability`, and `component`.

**Filters:** `select`, `boolean`, `dateRange`, `belongsTo`, `custom(label, queryFn)`. Each serialises to a URL query parameter.

**Actions:** row actions (one record) and bulk actions (selected rows; all filtered rows per FR-17, in chunks of 500 with a transaction per chunk). Both support `confirm(message)`, optional dialog form fields, `ability`, and return `{ message }` or `{ redirect }`. A thrown error rolls back and shows an error toast. In bulk, records failing the ability are skipped and reported.

## 6. Auth, permissions, validation

**Auth:** `config/admin.ts` names the guard (default: app default) and `loginUrl`. The installer adds an `accessAdmin` ability to `app/abilities/main.ts` that returns `false`.

**Permissions:** policy methods checked per resource. A missing method means denied.

| Policy method | Gates | When checked |
| --- | --- | --- |
| `viewList(user)` | Nav item and list page | Every list request |
| `view(user, record)` | Detail page, row link | Detail request; per row for links |
| `create(user)` | Create button and form | Form load and submit |
| `update(user, record)` | Edit button, form | Form load and submit |
| `delete(user, record)` | Delete action | Action run |
| Custom, e.g. `publish` | Actions/fields with `.ability('publish')` | Action run; per record in bulk |

The server computes abilities once per request and sends them as Inertia props. The UI hides what the server would reject, but the server always checks.

**Validation:** payload limited to declared fields, then passed to the named VineJS validator. `E_VALIDATION_ERROR` messages map to fields by path, including nested and array paths (`tags.0`). File fields validate size and MIME on upload, then the record validates through the resource validator.

## 7. Commands

| Command | Behaviour |
| --- | --- |
| `node ace add @mezielabs/azu` | Registers provider, writes `config/admin.ts` and `start/admin.ts`, adds `accessAdmin`, mounts routes at `/admin`, adds the admin Vite entry |
| `node ace make:admin-resource <Model>` | Introspects columns, casts, relations; writes `app/admin/resources/<model>_resource.ts`. Flags: `--validator`, `--policy`, `--readonly` |
| `node ace make:admin-action <Name>` | Scaffolds a reusable action class |
| `node ace admin:publish [page]` | Copies a page or component into `inertia/admin/`; no argument lists options |
| `node ace admin:doctor` | Checks config, missing policy methods, validators not covering declared fields, drifted published files |

Generator mapping:

- `string` → `text`; columns named `description`, `body`, `content` → `richText`
- `boolean` → `boolean`; `number` → `number`; `DateTime` → `datetime`
- enum check or TS union type → `select` with those options
- foreign key with a `belongsTo` relation → `belongsTo`, titled by the related model's first string column
- skip `password`, `rememberMeToken`, and `serializeAs: null` columns
- search defaults to the first two string columns; `title` defaults to `name`, `title`, or `email`

## 8. Frontend

React 19 Inertia pages, Tailwind, headless components, served from a separate Vite entry.

**Pages:** `Admin/Dashboard`, `Admin/Resource/Index`, `Create`, `Edit`, `Show`. Each receives one typed props object: schema, data, abilities.

**Overrides, smallest first:**

1. **Config:** labels, icons, colours, page size in the resource or `config/admin.ts`.
2. **Component swap:** `field.text('sku').component('SkuInput')` or `column.custom('stock', 'StockBar')` resolves a React component from `inertia/admin/components`, registered by file name (`sku_input.tsx` → `SkuInput`). Field components receive `value`, `onChange`, `field`, `errors`, `record`. Export the prop types from `@mezielabs/azu-react` (`FieldProps<T>`).
3. **Page publish:** `admin:publish Resource/Index` copies a page into the app; Azu renders the app's copy.

Named slots on every page (`header`, `toolbar`, `beforeTable`, `afterForm`) cover cases between levels 2 and 3.

**Theming:** CSS variables generated from one `brand.color`, with light and dark palettes. Dark mode follows the OS with a remembered toggle.

**URL state:** search, sort, filters, page, and page size are query parameters. Inertia partial reloads refresh only table data.

## 9. Packages and config

```
packages/
  core/    @mezielabs/azu        provider, resource API, controllers, commands (MIT)
  react/   @mezielabs/azu-react  Inertia pages and components (MIT, installed with core)
apps/
  demo/    AdonisJS 7 store app (products, categories, tags, orders, users) used in CI
  docs/    documentation site (later)
```

```ts
// config/admin.ts
import { defineConfig } from '@mezielabs/azu'

export default defineConfig({
  path: '/admin',
  guard: 'web',
  loginUrl: '/login',
  brand: { name: 'Acme', logo: '/images/logo.svg', color: '#2563eb' },
  perPage: 25,
  defaultDisk: 's3',
  resources: { autoload: 'app/admin/resources' },
})
```

## 10. Testing

- **Unit (Japa):** every builder; generator column mapping; ability resolution.
- **Integration (Japa API client):** each controller against the demo app on Postgres, MySQL, SQLite, with a forbidden-path test for every policy method.
- **Browser (Japa browser client):** install to first resource, create/edit with validation errors, a bulk action, dark mode.
- **Performance:** seeded 100,000-row table against the 200 ms p95 target, run before each release.
- **Accessibility:** automated axe checks on core pages in CI.

## 11. Milestones

| Phase | Scope | Exit criteria |
| --- | --- | --- |
| 0. Spike (2–3 days) | Monorepo skeleton, demo app, and three risk checks (below) | Written findings in `docs/spike-findings.md`; owner approves Phase 1 |
| 1. Weeks 1–3 | FR-01 to FR-08: install, access gate, resources, generator, list/forms/detail, core fields, belongsTo/hasMany | Generated Product resource works end to end in the demo app |
| 2. Weeks 4–5 | FR-10 to FR-14: VineJS, Bouncer, Drive uploads, actions, filters, theming | Permission and validation tests pass; v0.x preview published |
| 3. Week 6 | Docs, quickstart, demo polish, v1.0 release | README quickstart works on a fresh app in under five minutes |
| v1.1 | P1 items: FR-09, FR-15, FR-16, FR-17 | |

**Phase 0 risk checks:**

1. **Type inference:** can `defineResource(Model, …)` infer Lucid attribute and relation names well enough that misspelled names fail `tsc`, without forcing users to write generics?
2. **VineJS introspection:** can required, maxLength, and min/max be read from a compiled VineJS validator at runtime? If not, what's the fallback?
3. **Shipping Inertia React pages from a package:** how does the app's Vite build pick up pages and components living in `node_modules`, with a separate admin entry and override resolution (app copy first, package second)?

For each: what works, what doesn't, the recommended approach, and any spec changes it forces.

## 12. Open technical questions

- Does the free core include read-only CSV export? (Currently Pro.)
- Design the React component contract so a Vue front end can follow later without changing resource definitions.
- Which headless component library and rich text editor version to standardise on (proposal: Radix or React Aria; Tiptap).
