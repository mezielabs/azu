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
| FR-04 | Generator `make:admin-resource` | Output for any Lucid model compiles, renders list and forms, and saves through the generated validator, with zero edits | P0 |
| FR-05 | List screen: pagination, sorting, search | Server-side; page sizes 10/25/50/100; sort, search, and page survive reload via the URL | P0 |
| FR-06 | Create, edit, and detail screens | Save redirects to detail with a success toast; unsaved-changes warning on navigate away | P0 |
| FR-07 | Core field types | text, textarea, number, decimal, boolean, select, date, datetime, richText, file, image (via Drive) | P0 |
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
| Performance | List page server response under 200 ms at p95 for 100,000 rows, 25 per page, on Postgres with indexed sort columns. No N+1: relations shown in columns are preloaded. Searches use `ILIKE '%term%'`, so on Postgres the search columns need trigram (`pg_trgm`) GIN indexes; a B-tree can't serve a leading wildcard. Measured 2026-10-13 on 100,000 demo products, Postgres 18, production mode, sequential requests: worst p95 40 ms across first page, sorts, a 101-match search, deep pages and 100 per page; 162 ms for a search matching every row. Without trigram indexes, search was 598 ms. Check with `pnpm bench:list` before each release. |
| Security | Every admin route and action authorises server-side, never only by hiding UI. CSRF on all writes. Mass assignment limited to declared fields. Uploads restricted by MIME type and size per field. |
| Accessibility | WCAG 2.1 AA on core screens: keyboard navigation, focus states, labelled inputs, 4.5:1 contrast in both themes. |
| Compatibility | AdonisJS 7, Node 24+, Inertia with React 19, Lucid on Postgres, MySQL, and SQLite. Latest two versions of Chrome, Firefox, Safari, Edge. |
| Type safety | Resource definitions typed against the model: a misspelled column or field name fails `tsc`. |
| Bundle | Admin JS loads only on `/admin` routes via a separate Vite entry; zero added weight on public pages. Budget, checked in CI against the demo's production build: ≤ 120 kB gz of initial admin JS (the admin entry and its static imports), and ≤ 160 kB gz per page's lazy chunk (what a page loads beyond the initial JS). |
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
    column.decimal('price').format('currency', 'NGN').sortable(),
    column.belongsTo('category', 'name'),
    column.badge('status').colors({ draft: 'gray', published: 'green' }),
    column.datetime('createdAt').sortable().hiddenByDefault(),
  ],

  fields: [
    field.text('name'),
    field.text('sku'),
    field.decimal('price').min(0),
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
  - Sortable columns, `search`, and form fields must be persisted columns. Getters are display-only columns.
  - Telling getters apart from columns needs AdonisJS 7's generated schema classes (the `$columns` tuple). Hand-written models without it still get name checks, but a sortable getter compiles.
  - Bulk action handlers receive typed records: in `.handle(async (products) => …)`, `products` is `Product[]` with no annotation.
- **Required comes from the validator.** Fields have no `required()`. The form reads hints from the compiled VineJS validator where it can: required, minLength/maxLength, min/max, step, pattern, choices, and array sizes.
  - Fields with conditional rules (`requiredWhen` and similar) show as optional; the server still enforces them.
  - Union and group schemas give no hints, because their shape depends on the data.
  - Explicit field hints such as `field.decimal('price').min(0)` override introspection, for the UI only. They never change validation.
- **Decimals stay strings.** `column.decimal()` and `field.decimal()` take attributes typed `string`: decimal columns, as Lucid's schema generator types them on Postgres. Values stay exact strings from the database to the browser and back. They're formatted with `Intl.NumberFormat`, which formats numeric strings exactly, and never converted through `Number`. `column.number()` and `field.number()` take attributes typed `number`. Using the wrong one fails `tsc`.
- **Validator metadata.** Azu passes `{ record }` as VineJS metadata: the record being edited on update, `undefined` on create. A resource can map it with `validators.meta: ({ record, ctx }) => ({ productId: record?.id })` when its validators expect a different shape.
- **Discovery by convention.** Files in `resources.autoload` (default `app/admin/resources`) load at boot; each must export a resource as its default. With `resources: { autoload: false }`, `start/admin.ts` registers resources explicitly: `azu.register(resource)`, with `azu` from `@mezielabs/azu/services/main`. The installer writes `start/admin.ts`, registers it as a preload, and adds a `#admin/*` import alias. Two resources with the same URL name are an error at boot.
- **Names and labels.** A resource's URL name and labels come from the model: `OrderItem` → `order-items`, "Order items", "Order item". `label` and `singularLabel` override the labels.
- **Builders fit their kind.** Kind-specific methods only compile on the kinds they belong to: `format()` on number and decimal columns, `colors()` on badges, `options()` on select fields, `min`/`max`/`step` on number and decimal fields, `disk`/`maxSize` on file and image fields, `searchable()` on relation fields. `filter.custom`'s query and an action's records are typed against the model, and a row action's handler gets one record.
- **Hooks.** `beforeSave`, `afterSave`, `beforeDelete` receive the model instance and the HTTP context.
- **Preloading.** The list preloads every `belongsTo` column's relation with `preloadOnce`, so a `query` hook's own preload (and its callback) wins and nothing is loaded twice. A list never runs a query per row.
- **Defaults.** Omitting `columns` or `fields` falls back to what the generator would produce. This arrives with the generator (FR-04): types are erased at runtime, so the defaults need the database's column metadata. Until then, omitted lists are empty.

## 5. Fields, columns, filters, actions

| Type | Form control | List column | Storage |
| --- | --- | --- | --- |
| `text` | Input, optional prefix/suffix | Text, truncated at 60 chars | String |
| `textarea` | Auto-growing textarea | Hidden by default | Text |
| `number` | Numeric input with min, max, step | Number, optional currency/percent format | Integer or float (`number` attribute) |
| `decimal` | Numeric input with min, max, step; the value stays a string | Exact, optional currency/percent format via `Intl.NumberFormat` | Decimal/numeric column (`string` attribute) |
| `boolean` | Toggle | Check or cross icon | Boolean |
| `select` | Dropdown, radios when 4 or fewer options | Badge with optional colours | String or enum |
| `date`, `datetime` | Date picker in the admin timezone (`timezone` in `config/admin.ts`, default: the server process's). Dates submit as `YYYY-MM-DD`. Datetimes submit as the exact instant, and the server hands the validator `YYYY-MM-DD HH:mm:ss` in the server process's timezone, the formats `vine.date()` accepts by default | Formatted, relative on hover | Luxon `DateTime` |
| `richText` | Tiptap editor, output sanitised | Hidden by default | HTML in text column |
| `file`, `image` | Drag-and-drop upload with preview | File name or thumbnail | Drive disk, key on the model |
| `belongsTo` | Searchable async select | Related title, linked | Foreign key |
| `hasMany` | Paginated table on detail page | Count | Lucid relation |
| `manyToMany` | Searchable picker | Count | Lucid relation |

Every field supports `label`, `help`, `placeholder`, `default`, `visibleOn('create' | 'edit')`, `readOnly`, `ability`, and `component`.

Forms and detail pages render `text`, `textarea`, `number`, `decimal`, `boolean`, `select`, `date` and `datetime` as of FR-06. Until FR-07 and FR-08 land, `richText`, `file`, `image` and relation fields are left out of forms, detail pages and writes.

**Filters:** `select`, `boolean`, `dateRange`, `belongsTo`, `custom(label, queryFn)`. Each serialises to a URL query parameter.

**Actions:** row actions (one record) and bulk actions (selected rows; all filtered rows per FR-17, in chunks of 500 with a transaction per chunk). Both support `confirm(message)`, optional dialog form fields, `ability`, and return `{ message }` or `{ redirect }`. A thrown error rolls back and shows an error toast. In bulk, records failing the ability are skipped and reported.

## 6. Auth, permissions, validation

**Auth:** `config/admin.ts` names the guard (default: app default) and `loginUrl` (default `/login`). The installer adds an `accessAdmin` ability to `app/abilities/main.ts` that returns `false`. If the app has no Bouncer yet, the installer doesn't install it (AdonisJS presets don't install their dependencies either); it explains how to add it, and the gate denies everyone until then.

The access gate runs on every admin route, after the admin root view is set up:

- Guests get a 302 to `loginUrl`. Inertia visits get a 409 location response instead, so the browser loads the app's login page rather than rendering it inside the admin app.
- Signed-in users must pass `accessAdmin`, or they get a 403 and the `azu/errors/forbidden` page.
- It fails closed. Without auth, without Bouncer, or without an `accessAdmin` ability, everyone is denied. The reason is logged for the developer, never shown to the user.

**Permissions:** policy methods checked per resource. A missing method means denied.

| Policy method | Gates | When checked |
| --- | --- | --- |
| `viewList(user)` | Nav item and list page | Every admin page (to build the navigation) and every list request |
| `view(user, record)` | Detail page, row link | Detail request; per row for links |
| `create(user)` | Create button and form | Form load and submit |
| `update(user, record)` | Edit button, form | Form load and submit |
| `delete(user, record)` | Delete action | Action run |
| Custom, e.g. `publish` | Actions/fields with `.ability('publish')` | Action run; per record in bulk |

The server computes abilities once per request and sends them as Inertia props. The UI hides what the server would reject, but the server always checks.

**Validation:** payload limited to declared fields, then passed to the named VineJS validator with metadata (`{ record }` by default, or the result of `validators.meta`; see §4). `E_VALIDATION_ERROR` messages map to fields by path, including nested and array paths (`tags.0`). File fields validate size and MIME on upload, then the record validates through the resource validator.

How a save works (FR-06, FR-10):

1. The policy check runs first: `create`, or `update` with the record. Then the payload is cut down to the fields the form showed this user, minus `readOnly` ones. A field is shown when its `visibleOn` matches the form and the user passes its `ability`, which is checked with the record on edit.
2. The payload goes through the validator with the metadata. Update uses `validators.update`, falling back to `validators.create`. A resource with no validator for the operation can't save: the request fails with an error naming the missing validator, because Azu never writes unvalidated input.
3. Only the validator's output is written, limited to the same fields. `beforeSave`, the save and `afterSave` share a transaction.
4. Success redirects (303) to the detail page, and the form shows a toast. A validation failure renders the form again with a 422 and `errors`, keyed by path, and the form keeps what the user typed. Messages for paths no shown field covers, such as an attribute the resource doesn't declare as a field, appear in a summary at the top of the form.

Forms submit to their own URL: `POST /admin/resources/<name>/create` and `PUT /admin/resources/<name>/<id>/edit`. A 422 then leaves the address bar on the form. An id that can't exist, such as `abc` for an integer key, is a 404.

## 7. Commands

| Command | Behaviour |
| --- | --- |
| `node ace add @mezielabs/azu` | Registers provider, writes `config/admin.ts` and `start/admin.ts` (registered as a preload, with a `#admin/*` import alias), adds `accessAdmin` (when Bouncer is set up; otherwise explains how to add it), mounts routes at `/admin`, writes the admin Vite entry (`inertia/admin/app.tsx`) and adds the `azu()` plugin from `@mezielabs/azu/vite` to `vite.config.ts`, installs `@mezielabs/azu-react` (`--install`/`--no-install`, prompts otherwise) |
| `node ace make:admin-resource <Model>` | Introspects columns, casts, relations; writes `app/admin/resources/<model>_resource.ts` and, by default, a create/update validator in `app/validators/<model>.ts` derived from the model's columns (see below), named in the resource's `validators`. Flags: `--no-validator` (skip the validator), `--policy`, `--readonly` (no forms, so no validator) |
| `node ace make:admin-action <Name>` | Scaffolds a reusable action class |
| `node ace admin:publish [page]` | Copies a page or component into `inertia/admin/`. Page names are snake_case (`resource/index` → `inertia/admin/pages/resource/index.tsx`); `Resource/Index` is accepted too. No argument lists options |
| `node ace admin:doctor` | Checks config, missing policy methods, validators not covering declared fields, drifted published files |

Generator mapping:

- `string` → `text`; columns named `description`, `body`, `content` → `richText`
- `boolean` → `boolean`; `number` → `number`; decimal/numeric database columns → `decimal`; `DateTime` → `datetime`
- enum check or TS union type → `select` with those options
- foreign key with a `belongsTo` relation → `belongsTo`, titled by the related model's first string column
- skip `password`, `rememberMeToken`, and `serializeAs: null` columns
- search defaults to the first two string columns; `title` defaults to `name`, `title`, or `email`

Generated validator (unless `--no-validator`). Azu's rule is that a resource with no validator for an operation can't save, so the generator writes one rather than leaving a resource that can't save:

- **File and names:** `app/validators/<model>.ts` (snake_case, e.g. `order_item.ts`), exporting `create<Model>Validator` and `update<Model>Validator`. These are the names AdonisJS's `make:validator --resource` uses. The resource imports both and sets `validators: { create, update }`.
- **Which keys:** the same columns the resource gets as form fields. That leaves out the primary key, auto-managed timestamps (`autoCreate`/`autoUpdate`), and `password`, `rememberMeToken` and `serializeAs: null` columns. A `belongsTo` relation's key is its foreign key (`categoryId`).
- **Rules, from the column's database type:**
  - `varchar(n)` → `vine.string().trim().maxLength(n)`; text → `vine.string().trim()`
  - integer → `vine.number().withoutDecimals()`; float → `vine.number()`
  - `decimal(p, s)` → `vine.string().trim().regex(…)` allowing up to `p - s` integer digits and `s` decimal places, so the value stays an exact string, like `field.decimal()`
  - boolean → `vine.boolean()`; date, datetime and timestamp → `vine.date()`, which accepts what Azu's forms send (§5)
  - enum → `vine.enum([...])`
- **Optional and nullable:** a nullable column gets `.nullable().optional()`, and a column with a default gets `.optional()`. Everything else is required.
- **Database rules:**
  - A unique index adds `.unique({ table, column })`. The update validator's version skips the record being edited through `field.meta.record`, Azu's default metadata (§4), so no `validators.meta` is needed.
  - A foreign key adds `.exists({ table, column })` on the related key.
- **Existing files:** never overwritten. If `app/validators/<model>.ts` already exists, the generator warns and leaves `validators` out of the resource, so the app wires its own validators. Until it does, saving fails with the missing-validator error.
- **The validator is the app's code from then on.** It's a starting point to edit, like the resource, and Azu never regenerates it.

## 8. Frontend

React 19 Inertia pages and headless components, served from a separate Vite entry.

**Styling:** Azu ships its own prebuilt stylesheet, built with Tailwind inside `@mezielabs/azu-react`. The app doesn't need Tailwind. App components can use Azu's CSS variables, or the app's own Tailwind with an `@source` pointing at the package.

**Pages:** `azu/dashboard`, `azu/resource/index`, `azu/resource/create`, `azu/resource/edit`, `azu/resource/show`, `azu/errors/forbidden`, `azu/errors/not_found`. A resource's pages live under `/admin/resources/<name>`. Names are snake_case paths, like AdonisJS 7's own Inertia pages. Each page receives one typed props object (schema, data, abilities), typed in `@mezielabs/azu`. The resource schema (`ResourceSchema`, with its column, field, filter and action schemas) is plain JSON, defined in `@mezielabs/azu`. Absent values are `null`, never `undefined`. Every page also gets the shared `azu` props: the admin path, and the navigation built for this user.

**Overrides, smallest first:**

1. **Config:** labels, icons, colours, page size in the resource or `config/admin.ts`.
2. **Component swap:** `field.text('sku').component('SkuInput')` or `column.custom('stock', 'StockBar')` resolves a React component from `inertia/admin/components`, registered by file name (`sku_input.tsx` → `SkuInput`). Field components receive `value`, `onChange`, `field`, `errors`, `record`. The contract (`FieldProps<T>`) is defined in `@mezielabs/azu` and re-exported from `@mezielabs/azu-react`, so `import type { FieldProps } from '@mezielabs/azu-react'` works.
3. **Page publish:** `admin:publish resource/index` copies the page to `inertia/admin/pages/resource/index.tsx`; Azu renders the app's copy. `Resource/Index` is accepted too.

Named slots on every page (`header`, `toolbar`, `beforeTable`, `afterForm`) cover cases between levels 2 and 3.

**Theming:** CSS variables generated from one `brand.color`, with light and dark palettes. Dark mode follows the OS with a remembered toggle.

**URL state:** search, sort, filters, page, and page size are query parameters: `search`, `sort` and `direction` (`asc`/`desc`), `page`, and `perPage` (10, 25, 50 or 100; defaults to `perPage` in `config/admin.ts`). Defaults are left out of the URL. Invalid values fall back to defaults, sorting only accepts sortable columns, and a page past the end redirects to the last page. Parsing, URLs and cell formatting live in `@mezielabs/azu/shared`, plain TypeScript the server and front ends share (non-negotiable 11). Inertia partial reloads refresh only the `list` prop; the shared `azu` props are lazy, so a reload doesn't rebuild the navigation.

**Records:** clicking a list row opens its detail page when the policy's `view` allows it; selection stays on the checkboxes. Forms render required markers and limits (lengths, `min`/`max`/`step`, enum choices) from the operation's validator (§4). Leaving a form with unsaved changes asks first: a dialog for in-app navigation, and the browser's prompt for reloads and closing the tab. The browser's back button between admin pages can't be intercepted. Toasts appear in Azu's own `aria-live` region, rendered once beside the Inertia app so they survive the page change after a save.

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
  // IANA name; defaults to the server process's timezone (TZ)
  timezone: 'Africa/Lagos',
  resources: { autoload: 'app/admin/resources' },
  // Optional; must match azu({ entry }) in vite.config.ts
  entry: 'inertia/admin/app.tsx',
})
```

`path` can't be `/`; `defineConfig` throws so the panel never replaces the app's homepage.

## 10. Testing

- **Unit (Japa):** every builder; generator column mapping; ability resolution.
- **Integration (Japa API client):** each controller against the demo app on Postgres, MySQL, SQLite, with a forbidden-path test for every policy method.
- **Browser (Japa browser client):** install to first resource, create/edit with validation errors, a bulk action, dark mode.
- **Performance:** seeded 100,000-row table against the 200 ms p95 target, run before each release.
- **Accessibility:** automated axe checks on core pages in CI.

## 11. Milestones

| Phase | Scope | Exit criteria |
| --- | --- | --- |
| 0. Spike (2–3 days) | Monorepo skeleton, demo app, and three risk checks (below) | Written findings in `docs/spike-findings.md`; owner approves Phase 1 (approved 2026-10-12) |
| 1. Weeks 1–3 | FR-01 to FR-08: install, access gate, resources, generator, list/forms/detail, core fields, belongsTo/hasMany | Generated Product resource works end to end in the demo app |
| 2. Weeks 4–5 | FR-10 to FR-14: VineJS, Bouncer, Drive uploads, actions, filters, theming | Permission and validation tests pass; v0.x preview published |
| 3. Week 6 | Docs, quickstart, demo polish, v1.0 release | README quickstart works on a fresh app in under five minutes |
| v1.1 | P1 items: FR-09, FR-15, FR-16, FR-17 | |

**Phase 0 risk checks:**

1. **Type inference:** can `defineResource(Model, …)` infer Lucid attribute and relation names well enough that misspelled names fail `tsc`, without forcing users to write generics?
2. **VineJS introspection:** can required, maxLength, and min/max be read from a compiled VineJS validator at runtime? If not, what's the fallback?
3. **Shipping Inertia React pages from a package:** how does the app's Vite build pick up pages and components living in `node_modules`, with a separate admin entry and override resolution (app copy first, package second)?

For each: what works, what doesn't, the recommended approach, and any spec changes it forces.

**Phase 1, week one.** Phase 1 starts by closing the risks the spike left open, before building on them:

1. **`azu()` Vite plugin (FR-01).** Adds the admin entry and `resolve.dedupe`, and is installed with the assembler's `addVitePlugin` codemod. This is the one part of install the spike didn't verify.
2. **Postgres in CI.** Settle whether `decimal` columns arrive as strings before building number fields and currency formatting. Settled 2026-10-12: they do, so decimals get their own `decimal` column and field type (§4, §5).
3. **UI check of the riskiest components,** on React Aria Components and Tiptap:
   - an async `belongsTo` combobox
   - a timezone-aware date picker
   - the list table with keyboard row selection and a bulk action
   - a lazily loaded Tiptap editor

   React Aria and Tiptap stay approved only if this check passes (see `docs/decisions.md`).

## 12. Open technical questions

- Does the free core include read-only CSV export? (Currently Pro.)
- Design the React component contract so a Vue front end can follow later without changing resource definitions.
- ~~Which headless component library and rich text editor version to standardise on.~~ Closed 2026-10-12: React Aria Components (including its table) and Tiptap 3 as a lazily loaded optional peer, pending the week-one check in §11. See `docs/decisions.md`.
