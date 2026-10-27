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
| FR-04 | Generator `azu:resource` | Output for any Lucid model compiles, renders list and forms, and saves through the generated validator, with zero edits | P0 |
| FR-05 | List screen: pagination, sorting, search | Server-side; page sizes 10/25/50/100; sort, search, and page survive reload via the URL | P0 |
| FR-06 | Create, edit, and detail screens | Save redirects to detail with a success toast; unsaved-changes warning on navigate away | P0 |
| FR-07 | Core field types | text, textarea, number, decimal, boolean, select, date, datetime, richText, file, image (via Drive) | P0 |
| FR-08 | belongsTo and hasMany | belongsTo renders a searchable async select; hasMany renders a paginated table on detail | P0 |
| FR-09 | manyToMany picker | Attach and detach related records from the form with search | P1 |
| FR-10 | VineJS validation reuse | Create and update use the validators named on the resource; 422 errors render under each field | P0 |
| FR-11 | Bouncer permissions | Every screen, field, and action checks the resource policy server-side; disallowed UI is hidden | P0 |
| FR-12 | Row and bulk actions | Run on one or selected rows, with confirm dialog and result toast; failures roll back | P0 |
| FR-13 | Filters | select, boolean, and dateRange filters plus custom query filters, all encoded in the URL | P0 |
| FR-14 | Theming | Light and dark mode; brand colour, logo, and app name from `config/azu.ts` | P0 |
| FR-15 | Component overrides | Any field or column component can be swapped per resource; named slots on resource pages; `node ace azu:publish` copies pages for editing, stamped with their version; `node ace azu:doctor` reports drift | P1 |
| FR-16 | Navigation groups | Resources grouped, ordered, and given icons from the resource definition | P1 |
| FR-17 | Bulk action on all filtered rows | "Select all N matching" runs the action in chunks of 500 | P1 |
| FR-18 | Soft deletes | Trashed filter and restore action when the model uses soft deletes | P2 |
| FR-19 | Global search | Cmd/Ctrl+K palette searches every resource's title column | P2 |
| FR-20 | Custom screens | `defineScreen({ label, group?, icon?, order?, ability, component, data? })` in `app/admin/screens` (autoloaded, named after the file) renders at `<path>/screens/<name>` behind its required Bouncer ability, with `data` as a lazy prop and `ScreenProps<typeof screen>` typing the component; `node ace azu:screen <Name>` generates both files | P1 |
| FR-21 | Navigation links | `navigation.links` adds links to any URL in the navigation, grouped and ordered with resources and screens; an optional ability hides one; absolute URLs open in a new tab | P1 |
| FR-22 | Home screen | `home` in `config/azu.ts` renders a screen at `<path>/` or redirects to a resource's list; a user who fails the screen's ability, or the resource's `viewList`, gets the welcome page; a `home` naming nothing fails at boot | P1 |
| FR-23 | Screen forms | `defineScreen({ …, form: { fields, validator, load, save, successMessage? } })`, as an alternative to `component`, renders a resource-style form at `<path>/screens/<name>` and saves it with PUT to the same URL, behind the screen's ability; fields are typed against `load`'s return, limited to text, textarea, number, decimal, boolean, select, date, datetime and rich text; only declared, writable fields reach the validator, and `save` gets only its output; `azu:screen <Name> --form` generates the screen and its validator | P1 |
| FR-24 | Widgets on screens | `defineScreen({ …, widgets: [...], ranges? })`, as an alternative to `component` and `form`, renders value, progress, partition and table widgets from `metric` builders over resources: typed columns, the resource's `query` hook and `viewList` for every widget, ranges in the admin timezone kept in `?range=`, comparison with the previous period, links to the filtered list, and each widget loading on its own | P1 |
| FR-25 | Trend widgets | `metric.trend(label)` with `count`, `sum`, `avg`, `min` or `max(resource, column?)` and `.date(column)`, with optional `.by(unit)`, `.bars()`, `.compare()`, `.format()`, `.where()`, `.width()`, `.lowerIsBetter()`: a figure per hour, day, week or month in the admin timezone (the bucket follows the range unless `by()` sets it; at most 100), from one query per period, drawn as hand-written SVG with a tooltip, keyboard navigation, a table view and links to the list filtered to a bucket | P1 |

**Out of scope for v1:** Vue or Svelte front ends, a visual no-code builder, ORMs other than Lucid, AdonisJS versions before 7, a plugin marketplace, replacing the app's auth, and all Pro features (audit log, CSV import/export, impersonation, multi-tenancy, premium theme). Widgets and metrics on screens are core (FR-24, 2026-10-20); Pro's scope is to be decided again.

**Pro boundary:** Pro ships later as separate packages that plug into public core extension points. Design those extension points, but never import Pro code from core.

## 2. Non-functional requirements

| Area | Requirement |
| --- | --- |
| Performance | List page server response under 200 ms at p95 for 100,000 rows, 25 per page, on Postgres with indexed sort columns. No N+1: relations shown in columns are preloaded. Searches use `ILIKE '%term%'`, so on Postgres the search columns need trigram (`pg_trgm`) GIN indexes; a B-tree can't serve a leading wildcard. Measured 2026-10-13 on 100,000 demo products, Postgres 18, production mode, sequential requests: worst p95 40 ms across first page, sorts, a 101-match search, deep pages and 100 per page; 162 ms for a search matching every row. Without trigram indexes, search was 598 ms. Filters (FR-13), measured 2026-10-15 the same way: worst p95 47 ms for a filtered, sorted page (status, page 1,000 of 3,000, by price). Each filter alone, sorted, was 19–27 ms, and five combined with a search was 20 ms. Filters need no extra indexes at this size. Check with `pnpm bench:list` before each release. Widgets (FR-24): under 100 ms at p95 per widget on Postgres; measured 2026-10-20 on the demo's Overview with 100,000 orders, production mode, sequential partial reloads of each widget for each of its four ranges: worst p95 18.8 ms with an index on `orders.placed_at` (Recent orders, 15.5 ms on 30 days; values 6–13 ms), and 34.6 ms without it. Trends (FR-25), measured 2026-10-20 the same way: the Overview's revenue trend with `compare()` (two CASE queries) took 59.3 ms at p95 over 90 days by day (89 boundaries), 26.4 ms over a year by month, 24.8 ms over 30 days and 11 ms today by hour; every other widget stayed under 28 ms. Check with `pnpm bench:widgets` before each release. |
| Security | Every admin route and action authorises server-side, never only by hiding UI. CSRF on all writes. Mass assignment limited to declared fields. Uploads restricted by MIME type and size per field. |
| Accessibility | WCAG 2.1 AA on core screens: keyboard navigation, focus states, labelled inputs, 4.5:1 contrast in both themes. |
| Compatibility | AdonisJS 7, Node 24.21+ (earlier 24.x releases crash loading some dependencies, see docs/decisions.md), Inertia with React 19, Lucid on Postgres, MySQL, and SQLite. Latest two versions of Chrome, Firefox, Safari, Edge. |
| Type safety | Resource definitions typed against the model: a misspelled column or field name fails `tsc`. |
| Bundle | Admin JS loads only on `/admin` routes via a separate Vite entry; zero added weight on public pages. Budget, checked in CI against the demo's production build: ≤ 120 kB gz of initial admin JS (the admin entry and its static imports), ≤ 160 kB gz per page's lazy chunk (what a page loads beyond the initial JS), and ≤ 200 kB gz per optional-feature chunk (an `azu()` optional feature such as the Tiptap editor, loaded only when a form uses it; measured like a page, beyond the initial JS). |
| Upgrades | Semver. Published components carry a version stamp; `azu:doctor` flags drift. |
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
  order: 1,
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
      .handle(async (products, { trx }) => {
        await Product.query({ client: trx }).whereIn('id', products.map((p) => p.id)).update({ status: 'published' })
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
- **Discovery by convention.** Files in `resources.autoload` (default `app/admin/resources`) load at boot; each must export a resource as its default. With `resources: { autoload: false }`, `start/azu.ts` registers resources explicitly: `azu.register(resource)`, with `azu` from `@mezielabs/azu/services/main`. The installer writes `start/azu.ts`, registers it as a preload, and adds a `#admin/*` import alias. Two resources with the same URL name are an error at boot.
- **Names and labels.** A resource's URL name and labels come from the model: `OrderItem` → `order-items`, "Order items", "Order item". `label` and `singularLabel` override the labels.
- **Builders fit their kind.** Kind-specific methods only compile on the kinds they belong to: `format()` on number and decimal columns, `colors()` on badges, `options()` on select fields, `min`/`max`/`step` on number and decimal fields, `disk`/`maxSize` on file and image fields, `searchable()` on relation fields. `filter.custom`'s query and an action's records are typed against the model, and a row action's handler gets one record.
- **Hooks.** `beforeSave`, `afterSave`, `beforeDelete` receive the model instance and the HTTP context.
- **Preloading.** The list preloads every `belongsTo` column's relation with `preloadOnce`, so a `query` hook's own preload (and its callback) wins and nothing is loaded twice. A list never runs a query per row.
- **Defaults.** Omitting `columns` or `fields` falls back to what the generator would produce. This arrives with the generator (FR-04): types are erased at runtime, so the defaults need the database's column metadata. Until then, omitted lists are empty.

## 5. Fields, columns, filters, actions

**Labels:** a field, column, filter or action without `.label()` is labelled from its name in sentence case (`humanize()`), with SKU, ID, URL, API, VAT and UUID in capitals, plurals included (`sku` → "SKU", `userId` → "User ID", `imageUrls` → "Image URLs"). Resource labels follow the same rule from the model's name. An explicit label is used as written.

| Type | Form control | List column | Storage |
| --- | --- | --- | --- |
| `text` | Input, optional prefix/suffix | Text, truncated at 60 chars | String |
| `textarea` | Auto-growing textarea | Hidden by default | Text |
| `number` | Numeric input with min, max, step | Number, optional currency/percent format | Integer or float (`number` attribute) |
| `decimal` | Numeric input with min, max, step; the value stays a string. With a currency-formatted column of the same name, the input shows the currency code as a prefix (`number` too) | Exact, optional currency/percent format via `Intl.NumberFormat` | Decimal/numeric column (`string` attribute) |
| `boolean` | Toggle | Check or cross icon | Boolean |
| `select` | Dropdown, radios when 4 or fewer options | Badge with optional colours | String or enum |
| `date`, `datetime` | Date picker in the admin timezone (`timezone` in `config/azu.ts`, default: the server process's). Dates submit as `YYYY-MM-DD`. Datetimes submit as the exact instant, and the server hands the validator `YYYY-MM-DD HH:mm:ss` in the server process's timezone, the formats `vine.date()` accepts by default | Formatted, relative on hover | Luxon `DateTime` |
| `richText` | Tiptap editor (optional peer, lazy; a plain HTML textarea without it). Sanitised on the server with `sanitize-html` to Tiptap StarterKit's markup, before validation and again before display | Hidden by default | HTML in text column |
| `file`, `image` | Drag-and-drop upload with preview. `maxSize()` (default 5mb image, 10mb file) and `accept()` (MIME types, wildcards allowed) checked on the server; the type comes from the file's signature where the format has one. Defaults: JPEG, PNG, WebP, GIF, AVIF for images, plus PDF, text, CSV, Office and ZIP for files; SVG and HTML only when accepted explicitly | File name or thumbnail | Drive disk (`disk()`, else `defaultDisk`, else Drive's default), key on the model |
| `belongsTo` | Searchable async select. Submits the relation's foreign key (`category` → `categoryId`), which the validator checks and errors use. Optional relations get a Clear button | Related title, linked | Foreign key |
| `hasMany` | Paginated table on the detail page, 10 rows a page, with the related resource's columns, less the `belongsTo` column back to the parent: the one whose `foreignKey` is the `hasMany`'s, from Lucid's relation metadata, so a custom key or column name works (a category's products table has no Category column; the products list keeps it). Needs a resource for the related model | Count | Lucid relation |
| `manyToMany` | Searchable picker: the attached records as removable tags, plus a search that adds one at a time. Submits the related keys (`tags` → `tagIds`). Read-only without the related resource's `viewList`, and on edit when attachments fall outside the related resource scope or exceed 200 | Not a list column yet | Lucid relation (pivot rows) |

Every field supports `label`, `help`, `placeholder`, `default`, `visibleOn('create' | 'edit')`, `readOnly`, `ability`, and `component`.

Forms and detail pages render `text`, `textarea`, `number`, `decimal`, `boolean`, `select`, `date` and `datetime` (FR-06), `belongsTo` (FR-08), and `richText`, `file` and `image` (FR-07). Detail pages show `hasMany` tables (FR-08). Forms and detail pages render `manyToMany` (FR-09).

Uploads (FR-07): an upload is checked first. If the save fails validation, nothing is stored. Otherwise it's stored on the disk under `<resource>/<field>/<uuid>.<ext>`, and the validator sees that key. Leaving a file field out of the request keeps the stored file; sending it empty removes it. A replaced or removed file is deleted from the disk after the save commits. URLs come from the disk's `getUrl()`, so private disks (signed URLs) aren't supported yet. Drive is an optional peer: a resource with file or image fields fails at boot without it.

**Columns on phones (layout 2/4):** below 768px the list renders a card per row instead of the table (see §8, List page). Cards have no selection yet, so bulk actions need a wider screen; each card has the row menu as a 44px button beside its badge, outside the card's link. The whole card is the link to the record, so a custom cell component (`column.custom()`, `.component()`) shouldn't render a link of its own: it would be a link inside a link.

**Filters:** `select`, `boolean`, `dateRange`, `belongsTo`, `custom(label, queryFn)`. Each serialises to a URL query parameter named after it (FR-13):

| Filter | Parameter | Query |
| --- | --- | --- |
| `select('status', options)` | `status=published`, one of the options | `status = 'published'` |
| `boolean('isFeatured')` | `isFeatured=true` or `false` | `is_featured = true` |
| `dateRange('createdAt')` | `createdAt=2026-10-01..2026-10-31`, either end optional | A `date` column compares dates. A datetime column covers whole days in the admin timezone: from midnight on the first day up to midnight after the last, compared in the form Lucid writes datetimes (the dialect's `dateTimeFormat`, in the server process's timezone) |
| `belongsTo('category')` | `category=3`, the related record's key | The foreign key (`category_id = 3`) |
| `custom('Low stock', q => …)` | `low-stock=1` (the label, kebab case) | The query function, typed against the model |

- **Parsing** lives in `@mezielabs/azu/shared` (`list_filters.ts`), shared by the server and the front end. A value that doesn't fit its filter (an unknown option, an impossible date, a malformed key) is dropped, and the list shows without it.
- **Names:** a filter can't use the list's own parameters (`page`, `perPage`, `sort`, `direction`, `search`), and two filters can't share a name. Both are errors at boot.
- **Page reset:** changing a filter goes back to page 1. Filters combine with search and sort, and a page past the end redirects to the last page with the filters kept.
- **`belongsTo` filters** reuse the `belongsTo` field's options query and its `viewList` rule. Options come from `GET /admin/resources/<name>/filters/<filter>/options?search=…`, which needs the resource's `viewList` (it gates the list) and the related resource's `viewList`, failing closed. A user without the related `viewList` doesn't get the filter, and its parameter is ignored. A key that names no related record through the related resource's `query` hook turns the filter off, so a list is never filtered by a record the user can't see.
- **The page** gets `list.filters`: the usable filters, each with its URL value, its selected record (`belongsTo`) and its options URL.

**Actions:** row actions (one record) and bulk actions (selected rows; all filtered rows per FR-17, in chunks of 500 with a transaction per chunk). Both support `confirm(message)`, dialog form fields with their validator (`fields(fields, validator)`), `ability`, `destructive()`, and return `{ message }` or `{ redirect }`. A thrown error rolls back and shows an error toast. In bulk, records failing the ability are skipped and reported.

How an action runs (FR-12):

- **Route:** `POST /admin/resources/<name>/actions/<row|bulk>/<action>`, JSON `{ ids, input? }`, answered with JSON `{ message, redirect, done, skipped, failed }`. A row action takes one id, a bulk action up to 1,000 ids (more through `matching`, FR-17). An unknown action is a 404.
- **Records** are found through the resource's `query` hook, so a scoped resource can't reach records outside its scope. Ids that don't exist count as skipped.
- **Ability:** each record must pass the action's policy method, `update` when it names none. Records that fail are skipped and reported in the message; when none pass, it's a 403, before the input is read.
- **Input** from the dialog is cut down to the action's fields and goes through its validator. Errors are a 422 `{ errors }` keyed by path, shown under each field, and the dialog stays open.
- **The handler** gets the records (one record for a row action) and `{ ctx, input, trx }`. It runs in one transaction, with the records bound to it. A thrown error rolls back the whole batch. An AdonisJS `Exception` below 500 shows its message with its status; anything else is logged and shows a generic message, with a 500.
- **Delete** is built in, as a row and a bulk action, when the policy has `delete`. It confirms first, runs `beforeDelete` for each record in the transaction, and deletes stored files after the commit. A resource can't declare its own `delete` action.
- **Abilities in the UI:** list rows and the detail page get the keys of the actions the user may run on them (`row.restock`, `bulk.delete`), one policy call per distinct method. The bulk toolbar offers an action when any selected row allows it.
- **All matching rows (FR-17):** with every row on the page selected and more rows matching, the bulk toolbar offers "Select all N matching" (then "All N matching selected" and "Clear selection"). Another page, search or filter, or a narrower selection, ends it. The request is `{ matching: { search, filters, count }, input? }`: the list's search and filter values, and the count the user saw.
  - **Gate:** the resource's `viewList` (it gates the list), then the search and filters are read as the list reads them, so a filter the user can't use is ignored. The dialog's input is validated before anything runs.
  - **Rows:** the matching keys are read once, up front, through the `query` hook, search and filters. The run covers those rows only, so rows that appear while it runs are left out. More than 10,000 is a 422 and more than the confirmed `count` is a 409, both before anything changes.
  - **Chunks:** 500 keys at a time, each in its own transaction. A chunk's records are read again inside it, through the same query, so a row that no longer matches (or was deleted) is skipped as "no longer matched". Each record must pass the action's policy method; the rest are skipped as before. The handler (or the built-in Delete) runs once per chunk.
  - **Failure:** a failed chunk rolls back and stops the run. Chunks before it stay committed. With at least one record done, the answer is a 200 whose `failed` counts the records left unchanged (that chunk and the rest), with a message that says the run stopped. With none done, it's the usual error status and message. The confirm dialog always opens for these runs, and above 500 records it says how a partial failure plays out. A run that stopped shows its toast as an error, and the list reloads. Running it again repeats the action on rows already done, so the README asks for handlers that are safe to run twice, or filters that drop done rows out.
  - **Report:** Azu's own message counts what was done and skipped (and why), formatted with thousands separators. A handler's `message` isn't shown; its `redirect` is followed only when the whole run succeeds.
  - **Size:** 10,000 rows per run, synchronously, in one request. Measured 2026-10-16 on Postgres 18, in the test suite: the demo's publish (one `UPDATE` per chunk) took 1.3 s for 10,000 products, and the built-in Delete (`beforeDelete` and a `DELETE` per record) took 12 s. Background runs for larger sets can come later.
- **After an action:** a toast (a live region) shows the message. On the list, the selection clears, the list reloads and focus moves to the table, where React Aria returns it to the cell it was last on. On a detail page the page reloads, and Delete goes to the list. `{ redirect }` visits that URL. A failure keeps the selection, so the user can change it and try again.

## 6. Auth, permissions, validation

**Auth:** `config/azu.ts` names the guard (default: app default) and `loginUrl` (default `/login`). The installer adds an `accessAdmin` ability to `app/abilities/main.ts` that returns `false`. If the app has no Bouncer yet, the installer doesn't install it (AdonisJS presets don't install their dependencies either); it explains how to add it, and the gate denies everyone until then.

The access gate runs on every admin route, after the admin root view is set up:

- Guests get a 302 to `loginUrl`. Inertia visits get a 409 location response instead, so the browser loads the app's login page rather than rendering it inside the admin app.
- Signed-in users must pass `accessAdmin`, or they get a 403 and the `azu/errors/forbidden` page.
- It fails closed. Without auth, without Bouncer, or without an `accessAdmin` ability, everyone is denied. The reason is logged for the developer, never shown to the user.

**Permissions:** policy methods checked per resource. A missing method means denied.

| Policy method | Gates | When checked |
| --- | --- | --- |
| `viewList(user)` | Nav item and list page | Every admin page (to build the navigation) and every list request |
| `view(user, record)` | Detail page, row link | Detail request; per row for links, including `hasMany` tables and `belongsTo` links |
| `create(user)` | Create button and form | Form load and submit |
| `update(user, record)` | Edit button, form | Form load and submit |
| `delete(user, record)` | Built-in Delete action (row and bulk) | List and detail page (to show it); action run, per record |
| Custom, e.g. `publish` | Actions/fields with `.ability('publish')`; actions without one check `update` | List and detail page (to show it); action run, per record |

The server computes abilities once per request and sends them as Inertia props. The UI hides what the server would reject, but the server always checks.

**Validation:** payload limited to declared fields, then passed to the named VineJS validator with metadata (`{ record }` by default, or the result of `validators.meta`; see §4). `E_VALIDATION_ERROR` messages map to fields by path, including nested and array paths (`tags.0`). File fields validate size and MIME on upload, then the record validates through the resource validator.

How a save works (FR-06, FR-10):

1. The policy check runs first: `create`, or `update` with the record. Then the payload is cut down to the fields the form showed this user, minus `readOnly` ones. A field is shown when its `visibleOn` matches the form and the user passes its `ability`, which is checked with the record on edit.
2. The payload goes through the validator with the metadata. Update uses `validators.update`, falling back to `validators.create`. A resource with no validator for the operation can't save: the request fails with an error naming the missing validator, because Azu never writes unvalidated input.
   On edit, read-only fields reach the validator with the record's current values, taken from the record and never the request, so a validator that requires them still passes. They're never written.
3. Only the validator's output is written, limited to the same fields. `beforeSave`, the save and `afterSave` share a transaction.
4. Success redirects (303) to the detail page, or with `_after` back to a fresh create form or the edit form (§8, Form page), and the form shows a toast. A validation failure renders the form again with a 422 and `errors`, keyed by path, and the form keeps what the user typed. Messages for paths no shown field covers, such as an attribute the resource doesn't declare as a field, appear in a summary at the top of the form.

Relations (FR-08):

- **`belongsTo` options** come from `GET /admin/resources/<name>/fields/<field>/options?search=…`, as JSON. It's gated like the form it serves: `create`, or `update` with the record named by `?record=<id>`, and the field must be on that form for the user (its `visibleOn` and `ability`, not `readOnly`). The user must also pass the related resource's `viewList`, failing closed: no resource for the related model, or no `viewList` on its policy, is a 403. Without it, the form shows the field read-only: the current record, no options, never written. It returns up to 20 records whose title attribute (`searchable()`, else the related resource's `title`) contains the search, literally, sorted by title, through the related resource's `query` hook when there is one.
- **Relation keys:** picker values, options, and selected filters use Lucid's `localKey` (`belongsTo`) or `relatedKey` (`manyToMany`). Detail links use the related model's primary key.
- **`manyToMany` fields (FR-09)** submit the related records' keys under the relation's singular name plus `Ids` (`tags` → `tagIds`, `relatedProducts` → `relatedProductIds`), and the validator checks that array.
  - **Options:** they use the same options endpoint and rule as `belongsTo`. Without the related resource's `viewList`, the field is read-only: it shows the attached records, offers no options (403), and is never written. On edit, its current keys reach the validator, up to 200.
  - **Writes:** the validator's array replaces the attached records through Lucid's `sync`, repeated keys counted once. The sync runs after `save()` and before `afterSave`, in the save's transaction, so any failure rolls back the record and its pivot rows together. A request without the key leaves them as they are, and an empty array detaches them all.
  - **Display:** the form and the detail page show up to 200 attached records, by title, through the related resource's `query` hook, each linked when the user may `view` it.
  - **Scoped attachments:** if the scoped display omits attached records, the picker is read-only with a reason and no options (403). The server repeats the check on submission and never syncs this incomplete set; current unscoped keys reach the validator. A fully visible scoped set remains editable.
  - **Multipart:** empty selections are transported as the exact string `[]` when uploading a file, then normalized to an empty array only for declared writable `manyToMany` inputs before validation. Omitted inputs keep their existing meaning; other strings are not JSON-decoded.
  - **Past 200:** an edit form for a record with more than 200 attached (distinct related keys counted from the pivot rows, unscoped) shows the field read-only, with `readOnlyReason` ("350 tags attached; too many to edit here") under it, and no options (403). The form doesn't send the key, and the server never syncs it or passes it to the validator, so a save can't detach the records the form didn't load.
- **`hasMany` tables** show only when the user passes the related resource's `viewList`. They use the related resource's columns, `query` hook and preloads, and check `view` per row for links. Each table's page is a query parameter (`productsPage`), and paging is a partial reload of `relations`.

Forms submit to their own URL: `POST /admin/resources/<name>/create` and `PUT /admin/resources/<name>/<id>/edit`. A 422 then leaves the address bar on the form. An id that can't exist, such as `abc` for an integer key, is a 404.

## 7. Commands

| Command | Behaviour |
| --- | --- |
| `node ace add @mezielabs/azu` | Registers provider, writes `config/azu.ts` and `start/azu.ts` (registered as a preload, with a `#admin/*` import alias), adds `accessAdmin` (when Bouncer is set up; otherwise explains how to add it), mounts routes at `/admin`, writes the admin Vite entry (`inertia/admin/app.tsx`) and adds the `azu()` plugin from `@mezielabs/azu/vite` to `vite.config.ts`, installs `@mezielabs/azu-react` (`--install`/`--no-install`, prompts otherwise; skipped when the app's package.json already lists it). Timed on a fresh starter kit in `docs/quickstart.md` |
| `node ace azu:resource <Model>` | Introspects columns, casts, relations; writes `app/admin/resources/<model>_resource.ts` and, by default, a create/update validator in `app/validators/<model>.ts` derived from the model's columns (see below), named in the resource's `validators`. Flags: `--no-validator` (skip the validator), `--policy`, `--readonly` (no forms, so no validator) |
| `node ace azu:action <Name>` | Writes `app/admin/actions/<name>.ts` from a stub: a row action (`--bulk` for bulk) built with `action.row()`, named and with its ability in camelCase (`MarkAsPaid` → `markAsPaid`), a `confirm`, and a handler that saves through `trx`. Refuses `delete` and won't overwrite without `--force`. Exported as the file's default, so any resource can list it; `tsc` checks the ability against each resource's policy |
| `node ace azu:screen <Name>` | Writes `app/admin/screens/<snake>.ts` (a `defineScreen` with `accessAdmin` as its ability, a label from the name and a small `data` function) and `inertia/admin/components/<snake>.tsx` (the component, typed with `ScreenProps<typeof screen>`), from stubs, as AdonisJS's own `make:` commands do. Both compile and render with no edits. `--form` (FR-23) writes a form screen instead, with a text and a boolean field and values kept in memory until `load` and `save` use the app's storage, plus its validator in `app/validators/<snake>.ts` (`<camel>Validator`), and no component; both compile, render and save with no edits. `--force` overwrites |
| `node ace azu:publish [page]` | Copies one of Azu's pages from the installed `@mezielabs/azu-react` (which ships `src/pages`) into `inertia/admin/pages`. Page names are snake_case (`resource/index` → `inertia/admin/pages/resource/index.tsx`); `Resource/Index` and `azu/resource/index` are accepted too. The copy starts with a stamp: `// azu-publish: resource/index@<version> sha256:<hash of the original>`. It refuses to replace an existing file without `--force`. No argument lists the pages, marking published ones. Pages only: Azu's own components aren't resolved from the app, so a copied one would never render |
| `node ace azu:doctor` | Boots the app and checks: config that points at missing things (the `guard` in config/auth.ts, upload disks in config/drive.ts, the Vite `entry`, the `azu()` plugin in vite.config.ts, the autoload directory, no resources); policy methods resources rely on (`viewList`, `view`, `create`/`update` with form fields, a field's `ability`; an action's ability is an error, since the action can never run); form fields whose input the create or update validator doesn't declare (errors, since VineJS drops them); component names from fields, columns, slots and screens that no file in `inertia/admin/components` registers, and two files registering one name; and published pages whose original changed (a stamp hash that no longer matches the installed page), unstamped pages, and pages Azu doesn't have. Errors exit with 1; warnings and notes don't. Screens and links (FR-20 to FR-22): a `home` naming no screen or resource is an error, and a link whose group `navigation.groups` doesn't list is a note. Screen forms (FR-23): a form field the screen's validator doesn't declare is an error (read-only fields aren't checked), and a validator it can't introspect is a note; form screens have no component to check. Widgets (FR-24, area `widgets`): a `link()` filter the resource doesn't have or a value it doesn't take, a `date()` column that isn't a date or datetime, and a widget missing what its kind needs are errors (boot refuses them too), and a resource whose policy has no `viewList` is a warning, since the widget never shows. Trends (FR-25): a `by()` that can need more than 100 buckets in one of the screen's ranges is an error |

Generator mapping:

- `string` → `text`; columns named `description`, `body`, `content` → `richText`
- `boolean` → `boolean`; `number` → `number`; decimal/numeric database columns → `decimal`; `DateTime` → `datetime`
- enum check or TS union type → `select` with those options
- foreign key with a `belongsTo` relation → `belongsTo`, titled by the related model's first string column
- `manyToMany` relation → `field.manyToMany(name).searchable(title)` after the column fields, and `<singular>Ids: vine.array(vine.number().exists({ table, column })).optional()` (`vine.string()` for non-integer keys) in both validators
- skip `password`, `rememberMeToken`, and `serializeAs: null` columns
- search defaults to the first two string columns; `title` defaults to `name`, `title`, or `email`
- the field type comes from the model's declared TypeScript type when there is one, so the resource compiles against the model. That's the model file, or the schema class it extends from `#database/schema`. Otherwise it comes from the database type. A `string` decimal is `decimal` even on SQLite, which stores decimals as floats. Long text (`text` columns) is `textarea`.
- fields and columns follow the table's column order. The list shows the title column and the next five; the rest, and an auto-created `createdAt`, start `hiddenByDefault()`. Long text stays off the list.
- the generator reads the database through per-dialect queries (Postgres, MySQL, SQLite), because Lucid's `columnsInfo` lacks decimal precision, enum values, unique indexes and foreign keys. The files are formatted with the app's own Prettier when it has one.

Policy. The resource imports `app/policies/<model>_policy.ts`. If there's none, the generator stops and asks for `--policy`, which writes one:

- `viewList`, `view`, `create` and `update` return `true` for everyone who passes the `accessAdmin` gate, with a comment to narrow them. There's no `delete` method, so deleting is denied until one is written.
- If the table has a required column that no field covers (no default, not nullable, such as `users.password`), the policy has no `create` either, with a comment saying why: those records can't be created from the admin panel. The generator warns about it.
- `--readonly` writes only `viewList` and `view`, and no validators.
- An existing policy is used as it is; `--policy` never replaces it.

The generator's proof, `pnpm prove:generator` (and CI, on all three databases), runs it on every demo model in a copy of the demo with its resources, policies and tests removed. It then typechecks the copy and lists, creates, shows and edits each resource through HTTP, with zero hand edits. Users are the one model that can't be created, because of `users.password`.

Generated validator (unless `--no-validator`). Azu's rule is that a resource with no validator for an operation can't save, so the generator writes one rather than leaving a resource that can't save:

- **File and names:** `app/validators/<model>.ts` (snake_case, e.g. `order_item.ts`), or `app/validators/<model>_admin.ts` when the app already has `<model>.ts` (a signup `user.ts`, say). It exports `create<Model>Validator` and `update<Model>Validator`, the names AdonisJS's `make:validator --resource` uses. The resource imports both and sets `validators: { create, update }`.
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
- **Existing files:** never overwritten. An app's own `<model>.ts` stays as it is, and the admin validators go in `<model>_admin.ts`. An existing resource file is an error; the generator doesn't replace it.
- **The validator is the app's code from then on.** It's a starting point to edit, like the resource, and Azu never regenerates it.

## 8. Frontend

React 19 Inertia pages and headless components, served from a separate Vite entry.

**Styling:** Azu ships its own prebuilt stylesheet, built with Tailwind inside `@mezielabs/azu-react`. The app doesn't need Tailwind. App components can use Azu's CSS variables, or the app's own Tailwind with an `@source` pointing at the package.

**Pages:** `azu/dashboard`, `azu/resource/index`, `azu/resource/create`, `azu/resource/edit`, `azu/resource/show`, `azu/errors/forbidden`, `azu/errors/not_found`. A resource's pages live under `/admin/resources/<name>`. Names are snake_case paths, like AdonisJS 7's own Inertia pages. Each page receives one typed props object (schema, data, abilities), typed in `@mezielabs/azu`. The resource schema (`ResourceSchema`, with its column, field, filter and action schemas) is plain JSON, defined in `@mezielabs/azu`. Absent values are `null`, never `undefined`. Every page also gets the shared `azu` props: the admin path, and the navigation built for this user.

**Overrides, smallest first:**

1. **Config:** labels, icons, colours, page size in the resource or `config/azu.ts`.
2. **Component swap:** `field.text('sku').component('SkuInput')`, `.component()` on any column, or `column.custom('stock', 'StockBar')` resolves a React component from `inertia/admin/components`, registered by file name (`sku_input.tsx` → `SkuInput`, `componentName` in `@mezielabs/azu/shared`). Field components receive `value`, `onChange`, `field`, `errors`, `record` (`FieldProps<T>`); cells receive `value`, `record` (the row) and `column` (`CellProps<T>`). The contracts are defined in `@mezielabs/azu` and re-exported from `@mezielabs/azu-react`, so `import type { FieldProps } from '@mezielabs/azu-react'` works. A name with no registered component falls back to Azu's own control or cell.
   - **Loading:** the admin entry registers components with a lazy `import.meta.glob('./components/**/*.tsx')` (an eager glob still works). Each is its own chunk. The page resolver loads the components a page renders (`usedComponentNames`: the list's columns and action fields, the form's fields, the detail page's `hasMany` columns and action fields, and that page's slots) together with the page, so they're ready on first paint. Should one still be loading, a field shows its label over an input-sized placeholder, a cell a one-line placeholder, and a slot a one-line box.
3. **Page publish:** `azu:publish resource/index` copies the page to `inertia/admin/pages/resource/index.tsx`; Azu renders the app's copy. `Resource/Index` is accepted too. Package pages import only from `@mezielabs/azu-react` and `@mezielabs/azu/*`, never by relative path, so the copy compiles in the app unchanged.

**Slots (FR-15)** cover cases between levels 2 and 3. A resource's `slots` option names a registered component for each slot: `slots: { toolbar: 'PrintOrder' }` (the demo's Orders, a Print button on the detail page). The schema carries all four (`header`, `toolbar`, `beforeTable`, `afterForm`), `null` when unset.

- `header`: under the page title, on the list, create, edit and detail pages.
- `toolbar`: in the page header, before the page's own buttons (New, the detail page's actions and Edit), on the same four pages.
- `beforeTable`: on the list, above the bulk toolbar and the table.
- `afterForm`: under the create and edit forms.

A slot component receives `SlotProps`: `resource`, `page` (`index`, `create`, `edit`, `show`), `record` (`{ id, title }` on edit and detail, else `null`) and `path` (the resource's list URL). Unset, or naming no registered component, a slot renders nothing; `azu:doctor` reports the second case. `<Slot>` is exported, so published pages keep their slots. The dashboard and error pages have no slots; publish them instead.

**Theming (FR-14):** CSS variables generated from one `brand.color`, with light and dark palettes. Dark mode follows the OS (System) until the user picks Light or Dark, which is remembered.

- **Palettes:** `palette(color, theme)` in core (`src/theme`, plain TypeScript, no dependency) gives Azu's own variables (non-negotiable 9): neutrals (`surface`, `subtle`, `text`, `muted`, `border`), brand (`brand` for text and accents, `brand-solid` and `on-brand` for filled areas), danger, success, and a background and text pair for each badge colour (gray, green, blue, red, yellow).
- **Contrast:** every text pair reaches WCAG AA, 4.5:1, for any brand colour. `brand` is the configured colour with only its OKLCH lightness moved as far as 4.5:1 against `surface` and `subtle` needs, so the hue stays. `on-brand` is white or near-black, falling back to black on the mid-tones where near-black misses. A unit test tries fifteen brand colours, from white to black, in both themes.
- **Delivery:** the root view inlines the palettes as a `<style>`, built once at boot. Light is the default; dark applies under `prefers-color-scheme: dark` unless `data-azu-theme="light"` is on `<html>`, or when it's `"dark"`. A boot script sets that attribute from `localStorage` (`azu-theme`) before the first paint. Both carry Shield's CSP nonce. The stylesheet keeps the default brand's palettes as zero-specificity fallbacks.
- **Choice:** the account menu's Theme section, a single-selection group of Light, Dark and System, with a check on the current one (`applyThemeSetting()`, `currentThemeSetting()`); the phone drawer offers the same three as radio rows. Light and Dark store the choice; System, the default, clears it, so the stylesheet's `prefers-color-scheme` rules follow the OS live. The boot script reads the same `azu-theme` key.
- **Name and logo:** `brand.name` (default `Admin`) heads the sidebar and page titles (`Products · Acme`). `brand.logo` is a decorative image beside it; without one, a brand-coloured tile with the name's first letter. Pages get them as `azu.brand`.
- **Checks:** the axe scans (§10) run in both themes.

**Shell:** no top bar on wide screens. A 248px sidebar holds the brand, a Dashboard link, the grouped navigation, and at the bottom an account button: the signed-in user (`azu.user`: `fullName`, else `name`, and `email`, read from the guard's user; initials as the avatar), each line truncated, with an up/down chevron, named "Account: <name>". It opens a menu upward (React Aria `MenuTrigger`): a header with the full name and email, the Theme section, a separator, View site (`siteUrl`, a full page load) and Sign out. The phone drawer keeps full-width rows: the user, the three theme choices, View site and Sign out. Inertia's progress bar is `var(--azu-brand)`, so it reads in both themes. Printed, a page drops the sidebar, the top bar, the page actions, the skip link and toasts (Azu's print stylesheet). The navigation's current item gets a brand tint, with its text pulled toward the text colour to keep AA. Below 768px, a sticky top bar with a menu button (44px) and the brand replaces the sidebar, and the menu opens the sidebar's contents as a modal drawer: React Aria's modal traps focus, closes on Escape or a press outside, returns focus to the menu button, and loads on first open. Rows in it are 44px. A "Skip to content" link comes first. Every page starts with the same `PageHeader`: a breadcrumb (the resource's group, then its list, then the record), the title, and the page's actions on the right.

- **Sign out:** `POST <path>/logout` (route `azu.logout`), outside the access gate so a user who has lost access can still sign out, with Shield's CSRF check. It calls the guard's `logout()`, then redirects to `loginUrl` (a 409 location response for Inertia visits). A guard without `logout()` is left alone, and logged. There's no `logoutUrl` setting: the app's own logout route doesn't run.

**List page (layout 2/4):** the page header's title carries the row count (without search and filters). The rows sit in one card: the controls (or the bulk bar), the table, and the footer. There's no summary strip, on any screen size.

- **Controls:** one line, always. The search, then a button per filter showing its label and, when it's on, its value ("Status Published"), tinted. It opens the filter's control in a popover; an on/off filter (`filter.custom`) is a toggle button (`aria-pressed`). Then Clear filters. Too many buttons for the row scroll sideways inside it. Below 1024px the filters open from a "Filters · n" button in a sheet instead. A date range is two labelled inputs, From and To.
- **Selection:** with rows selected, the bulk bar takes the controls' place at the same height (61px), inverted from the page: the count, "Select all N matching" (FR-17), Clear selection, then the bulk actions, split so the bar never wraps by the rule the detail header shares (`splitActions()`): three or fewer are all buttons, in declared order, destructive last; with more, the first two non-destructive ones as buttons and the rest in a "More" menu, destructive last and in danger style; below 1024px, all of them in one "Actions" menu. "Select all N matching" truncates before anything wraps. A visually hidden live region outside the bar announces the selection.
- **Table:** the title column's cell is a real link to the detail page (the rest of the row isn't). Sortable headers show a sort hint; the sorted one its direction. A badge shows the value's label (`ColumnSchema.labels`) from the resource's `select` field of the same name, else its `select` filter of that name (Orders' status), with a dot. An image column with no image shows a placeholder the thumbnail's size, and its header text is for screen readers only. The row actions button is borderless and opens the row menu: View when the user passes `view` for that row, Edit when they pass `update` (`ListRow.abilities.view` and `.update`, checked per row on the server), a separator, then the row actions they may run on it, destructive last. The menu shows whenever any item is available, so a resource with no row actions still gets one.
- **Footer:** "Showing 1–25 of 30", with " · filtered from 40" when a search or filter is on (`listRange()`; 40 is `meta.unfilteredTotal`, a count through the `query` hook without search and filters, run only then, `null` otherwise), Rows per page, and the pages: Previous, the first and last pages, the current one and its neighbours (`pageWindow()`), Next.
- **Empty:** with no rows, the table (or the phone cards) says why (`emptyListMessage()`): "No products match “zzz”", "No products match Status: Published", "No products match “zzz” with Status: Published", or "No products yet", with a button that clears what's narrowing it ("Clear search", "Clear filters", "Clear search and filters"). The header cells keep the widths they had with rows, so the columns don't move.
- **Below 768px:** rows are cards (`ListCards`): the first image column as the picture, the title, the next two columns as a line under it, the first badge column on the right; only one of the table or the cards renders. No selection there. The filters sheet's rows are 44px, toggles included, with a gap between the box and its label. New is a 44px icon button whose name stays "New product".

**Detail page (layout 3/4):** two columns, stacking below 768px.

- **Left, a Details card:** the fields, by label. A field with a list column of the same name is formatted as that column formats it, for number, decimal, badge and boolean columns without a component (the price in NGN, a status's label). `richText`, relations and dates keep the field's rendering.
- **Right:** a card per `image` or `file` field (the image at 4:3, "name · Open full size"), then a Record card with the ID and, when the model has the columns, Created and Updated (`timestamps`, ISO strings or `null`).
- **Title:** the resource's first shown badge column is a pill beside it, and the field of the same name leaves the Details list (`detailLayout()` in shared).
- **Actions:** the row actions the user may run follow the bulk bar's rule (`splitActions()`): three or fewer as buttons, destructive last (Restock, then Delete in danger style); more than three, the first two non-destructive as buttons and the rest in a "More" menu; below 1024px, one "Actions" menu. Edit is outside the rule: the primary button, after them, when the user may `update`.
- **One line:** the page header never wraps. A long title is cut short with an ellipsis, never the actions; the full title is its tooltip and the page's `<title>`. This holds for every page's header (`PageHeader`).
- **`hasMany` tables** are cards below, their heading carrying the count ("Products · 12"), without the column that points back to this record (§5, `hasManyColumns()`).
- **No fields:** when the user may see none of the resource's fields (Orders), the page gets `cells`, the record's column values as the list shows them (`belongsTo` columns loaded for it), and the Details card shows the columns, custom cell components included.

**Navigation (FR-16, FR-21):** built per request from the resources the user may `viewList`, the screens whose ability they pass, and the `navigation.links` they may see. Ungrouped items come first. Groups follow `navigation.groups` in `config/azu.ts`, then any others by label. Within a group, resources, screens and links sort together by `order` (lower first), then those without one, by label. Items carry `kind` (`resource`, `screen` or `link`) and `external`.

- **Links:** `{ label, url, group?, icon?, order?, ability? }`. An `ability` (a Bouncer ability object) only hides the link, failing closed. It doesn't protect the target, which must check access itself. An absolute `http(s)` URL is `external`: it opens in a new tab (`target="_blank"`, `rel="noopener"`), with an external-link icon and "(opens in a new tab)" for screen readers. Admin paths are Inertia links; other paths in the app are plain links.
- **Current item:** `currentNavigationItem()` in shared. A link is current when the URL's path and query (in any order) both match it. Otherwise it's the resource or screen the path is under, so the "Awaiting shipping" link, not Orders, is current on `/admin/resources/orders?status=paid`.
- **Home:** with a home screen (FR-22) the user may open, the first link takes its label and icon (`azu.home`), and the screen isn't listed again; otherwise it reads "Dashboard".

- **Icons:** `icon` is a Lucide icon name in kebab case. `lucide-react` is an optional peer of `@mezielabs/azu-react`, and without it the navigation has no icons.
- **Bundling:** `@mezielabs/azu-react/icons` is an empty map that the `azu()` Vite plugin replaces with a generated module. The plugin reads the resource files (`resources`, default `app/admin/resources`, plus its `icons` option) for `icon:` names, and imports one file per icon in use, so the bundle holds no others.
- **Unknown names and dev:** an unknown name is a build warning and renders nothing. In dev, an edit that changes the icons in use reloads the admin.
- **Agnostic plugin:** the front-end package's manifest (`azu.icons`) names the icon package and file pattern, so `azu()` knows nothing of React or Lucide.
- **Accessibility:** icons are decorative (`aria-hidden`); the link's label names it.

**Screens (FR-20):** `defineScreen({ label, group?, icon?, order?, ability, component, data? })` from `@mezielabs/azu`.

- **Discovery:** default exports from `app/admin/screens` load at boot (`screens.autoload`; `false` to call `azu.registerScreen(name, screen)` from `start/azu.ts`). Each is named after its file in kebab case: `sales_report.ts` → `sales-report`. Two screens with one name are a boot error.
- **Ability:** `ability` is required and is a Bouncer ability object (`Bouncer.ability(...)`), checked with `ctx.bouncer.allows(ability)` on every request. `false`, an ability that throws, or no Bouncer is denied (`abilityAllows()`).
- **Route:** `GET <path>/screens/:screen` (`azu.screens.show`), inside the access gate. An unknown screen is a 404; a failed ability is the forbidden page (403).
- **Page:** `azu/screen`, rendered through `renderPage`, with `screen` (`ScreenSchema`: name, label, group, icon, component, form) and `data`. `data(ctx)` is a lazy prop, so a partial reload of `data` computes only it, without the shared `azu` props. The page is the shell, a breadcrumb (group, then label, from `screenBreadcrumbs()` in shared; none for a screen without a group, since the label alone would repeat the title), a `PageHeader` with the label, then the registered component with `{ data, screen }`. A component no file registers renders an inline error naming it and the file to add. The page's component is preloaded with it (`usedComponentNames`), and `screen` is publishable like any other page.
- **Types:** `ScreenProps<typeof screen>` (in core, re-exported by `@mezielabs/azu-react`) types `data` as the awaited return of the screen's `data`. The component imports the screen's type from `#admin/screens/*`. The app's Inertia tsconfig already includes server code through AdonisJS's generated types, so the type import needs no setup.
- **Generator and doctor:** `node ace azu:screen <Name>` (§7). `azu:doctor` reports a screen component no file registers (error).
- **Icons:** the `azu()` plugin reads `icon:` names from `app/admin/screens` and `config/azu.ts` too (option `screens`), for screens and links.
- **Planned next:** screen actions (buttons on a screen that run server-side, like row actions). Not built yet. Screen forms are FR-23, below.

**Screen forms (FR-23):** `form: { fields, validator, load(ctx), save(input, ctx), successMessage? }` on `defineScreen`, instead of `component`.

- **Exclusivity:** a screen has exactly one of `component` or `form`, and no `data` beside a form. The variants are typed so that either mistake is a type error (`component?: never` and `data?: never` on the form variant, `form?: never` on the component one), and `defineScreen` throws a boot error naming the screen either way. It also checks that `load` and `save` are functions, that the validator has `validate`, and that there are fields.
- **Fields:** the resource field builders (`field.text()` and so on). Names are typed against `load`'s return type, by kind: text, textarea, select and rich text against `string` values, decimal against `string`, number against `number`, boolean against `boolean`, date and datetime against Luxon `DateTime`. A misspelled name or a mismatched kind fails `tsc`. File, image and relation fields (`belongsTo`, `manyToMany`, `hasMany`) are a type error and a boot error naming the field. `.ability()` on a field is a type error and a boot error: the screen's ability covers the form. `.readOnly()` works as on resources.
- **Hints:** each field's schema goes through `withHints()` with the validator's introspected hints (required, lengths, limits, a select's choices), as resource forms do. There are no list columns on a screen, so no currency is borrowed; a field's own `min`, `max`, `step` and `label` apply.
- **Routes:** `GET <path>/screens/:screen` renders the form; `PUT <path>/screens/:screen` (`azu.screens.update`) saves it. Both are inside the access gate and check the screen's ability (403, failing closed). A PUT to a component screen or an unknown one is a 404.
- **Page props:** `azu/screen` gains `form` (`ScreenFormData`: the fields, `load`'s values as `formValues()` formats a record's, and `successMessage`, default "<label> saved"; `null` for a component screen) and `errors`. `ScreenSchema` gains `form: boolean`, and its `component` is `null` for a form screen.
- **Save,** through the same helpers as resource saves (`readFieldInput()`, `currentInput()`, `validateInput()` in `forms/save_record.ts`):
  1. Only the declared, writable fields are read from the request (mass assignment). Datetimes are read in the admin timezone; rich text is sanitised before the validator.
  2. Read-only fields get `load`'s current values, never the request's, so a validator that requires them still passes.
  3. The validator runs. On errors, a 422 renders the form again with `errors`; the client keeps the input (`preserveState: 'errors'`).
  4. `save` gets the validator's output for the writable fields only. Read-only fields are never passed to it. A throw in `save` is a 500, as usual.
  5. A 303 back to the screen, which shows `load`'s values again; the client shows `successMessage` as a toast.
- **Page:** the resource form, through `ScreenForm` from `@mezielabs/azu-react`, inside the screen page's shell: the reading width, paired short fields, required markers and limits, the sticky save bar with its status and a single "Save changes" button (no Cancel, no secondary button), and the unsaved-changes guard. `cancelHref` became optional on `ResourceForm` for this. `ScreenForm` loads `ResourceForm` lazily, so a component screen's page chunk doesn't carry it (61.4 kB gz before FR-23, 62.0 kB after; a form screen loads the form chunk it shares with create and edit).
- **Storage stays the app's:** Azu never owns a settings table. The demo's Store settings screen reads and writes the app's own `settings` table (key, type, value) through `Setting.values(keys)` and `Setting.store(input)`.
- **Generator and doctor:** `node ace azu:screen <Name> --form` (§7). `azu:doctor` reports a form field whose name the screen's validator doesn't declare (error), and a validator it can't introspect (note), as for resources.

**Widgets (FR-24):** `widgets: ScreenWidget[]` and `ranges?: RangeName[]` on `defineScreen`, instead of `component` or `form`.

- **Exclusivity:** exactly one of `component`, `form` or `widgets` (type error where possible, boot error always); no `data` beside widgets, and `ranges` only on a widgets screen. Ranges default to `['30d']`, which shows no switch.
- **Builders (`metric`):** `value(label)`, `progress(label)` and `partition(label)` start from an aggregate: `count(resource)`, or `sum`, `avg`, `min`, `max(resource, column)`. `table(label).resource(resource)`. Value widgets can instead be `using(fn)`, which needs `.ability()`. Shared: `where(query => …)`, `date(column)`, `width(1–4)`. Value: `format()`, `link(filters?)`, `compare(false)`, `lowerIsBetter()` (a type error on other kinds), `compact(enabled?)`. Progress: `period()`, `goal(number | ctx => number)`, `format()`, `compact(enabled?)`. Partition: `groupBy(column)`, `limit(n)` (default 5), `format()`, `link(filters?)`, `compact(enabled?)`. `compact()` is a type error on tables and trends. Table: `latest(column)`, `orderBy(column, direction)`, `limit(n)` (default 5), `columns([...])`, `link(filters?)`.
- **Types:** `Resource` carries its columns' types (`defineResource` infers them), so numeric columns for `sum`/`avg`/`min`/`max` are the model's number columns plus the resource's `column.decimal()` ones (`NumericColumnOf`), `date()` takes the model's date and datetime columns, `groupBy`, `latest` and `orderBy` any persisted column, and `columns()` the resource's list column names. A resource without columns allows every string attribute as numeric, since nothing says which are decimals. `link()` filter names aren't typed (resources don't carry their filters' names); boot checks them and their values.
- **Access:** a resource-backed widget is listed only for users who pass the resource's `viewList` (`allows()`, failing closed); a `using()` widget, its ability (`abilityAllows()`). Others are left out of the page, and their data props don't exist, so a partial reload can't ask for them.
- **Queries:** `resource.model.query()`, the resource's `query` hook, the widget's `where()`, then the range on the `date()` column, then the aggregate (`clearSelect().clearOrder()` and `pojo()`, as the list's unfiltered count). Datetime columns compare instants in the form Lucid stores them (`databaseDateTime()`, in the server's timezone), with the upper bound rounded up to the next whole second, because stored times have whole-second precision; date columns compare whole days in the admin's timezone. Columns are qualified with the table name, so a hook's joins can't make them ambiguous.
- **Decimals:** results are exact decimal strings (`decimalResult()`): Postgres and MySQL strings as they are, SQLite numbers written out plainly. Decimal columns' results are rounded or padded to the column's scale, read from the database once per table and process (2 if unknown); `avg` of a number column to 2 places; counts and number columns' sums without decimals.
- **Ranges:** computed with Luxon in the admin's timezone (`rangeBounds()`). `7d`, `30d`, `90d`: from midnight N-1 days ago until now; the previous period is the same stretch N days earlier. `today`, `month`, `quarter`, `year`: from the start of the unit until now; the previous period starts at the start of the previous unit and runs as long as this one has so far, never past the start of this one (March 31st compares with February only). `?range=` (`RANGE_PARAM`) picks one the screen offers, else the first (`parseRange()`).
- **Comparison:** value widgets with a `date()` (or `using()`) and `compare` on get the previous period's value and `compareValues(current, previous, better)`: a change with its real `direction` (`up` or `down`), a one-decimal percentage and an `outcome` (`better` or `worse`, given `better: 'higher' | 'lower'`); `new` when the previous value is 0; `same` when they're equal. `new` and `same` are neutral either way. The arrow shows the direction, the colour follows the outcome (`data-azu-outcome`), and visually hidden words say "better" or "worse" after the percentage, so the meaning never rests on colour. `lowerIsBetter()` sets `better: 'lower'` for cancellations, refunds and response times; `WidgetSchema.better` says which. Without a `date()`, a widget is all-time: no comparison, and "All time" under its label.
- **Figures (U01):** value, progress and partition figures, the comparison's previous value and a partition's record count go through `formatFigure(value, format, compact)` in `@mezielabs/azu/shared`. From 1,000,000 up (`COMPACT_FROM`, compared on the exact digits, so 999,999.99 stays in full), it uses `Intl.NumberFormat` compact notation with at most 2 fraction digits and the widget's currency display (`compactNumberFormat()`, sharing `formatOptions()` with cards, tooltips and the trend axis): "NGN 4.28M", "-NGN 1.05B". Below that, the full figure. `WidgetSchema.compact` is `true` (always), `false` (never) or `null` (the threshold). An abbreviated figure is `aria-hidden`, with the exact figure in visually hidden text beside it and as the element's `title`. Cards are inline-size containers; the figure scales with `clamp()` in rem bounds and wraps with `overflow-wrap: anywhere`; Intl's no-break space after a currency code gets a `<wbr>` (`FigureText`), so a full figure breaks there before it splits digits, and never clips.
- **Progress:** its own `period()` to date, in the admin's timezone (`periodBounds()`, weeks from Monday): the value so far, the goal, the share reached, the pace (how far through the period now is) and the time left. A `role="progressbar"` with its value text, the fill, and a pace marker.
- **Partition:** grouped on the column, sorted by value (largest first), ties in the order of the column's options (select field, column labels, select filter), then by label, so rows never swap between loads or databases; the first `limit` shown and the same aggregate over the omitted records shown as "Other" (never a sum of averages or extrema). Labels: the resource's select field options, else its column's labels (select field or select filter), else `humanize()`. Each row has its share of the largest displayed value (the bar). Count/sum have a percentage of the total; avg/min/max have `percent: null`, omitted from the UI. The payload's `total` is the aggregate over all matching records; rows link to the list with the select filter on that column set to their value, when the resource has one and the value is an option.
- **Tables:** through `listRecords()`, like `hasMany` tables: the resource's columns (or the `columns()` subset, unsortable), its `query` hook and preloads, a `view` check per row for its link, and the total for "View all N". A table wider than its card scrolls sideways in the list table's own container; the card never grows past the grid.
- **Links:** to `<path>/resources/<name>` with the resource's own filters: the range as its `dateRange` filter on the `date()` column, when it has one, then `link()`'s filters, encoded as the list reads them (`linkFilterValue()`). A link only renders for users who passed `viewList`, so they can follow it. `where()` can't become list filters, so `link()`'s filters are the app's to keep matching it (the README says so).
- **Loading:** the page lists the widgets (`WidgetSchema`: key, kind, label, width, format, note, compares), the range (`RangeInfo`) and the offered `ranges`. Each widget's data is a deferred prop (`@adonisjs/inertia`'s `defer()`) named `widget<index>`, in a group of its own, so the client fetches each in its own request after the first paint. A widget that throws is caught, logged with the screen's and widget's names, and comes back as `{ status: 'error' }`; its card says "Couldn't load this", with a Try again button that reloads that widget's prop alone (`router.reload({ only: [key] })`). A range switch is a partial visit for `range` only (which updates `?range=`), then one async partial reload per widget; `<Deferred>` shows each card's loading state until its reload finishes. Partial reloads skip the shared `azu` props.
- **Page:** the screen page shows the range summary under the title (`rangeSummary()`: "Sep 21 – Oct 20, compared with the 30 days before · Africa/Lagos") and the range switch (`RangeSwitch`, pressed buttons in a "Date range" group) as its actions. `ScreenWidgets` loads the grid lazily, so other screens don't carry it: a 4-column grid (a container query: 2 columns under 56rem, 1 under 30rem), values with tabular numerals, partition bars, the progress bar, and table widgets with the list table's cells and badges. Marks use the brand colour; colours come from the theme variables, so dark mode needs nothing extra.
- **Doctor:** see §7.
- **Trends:** see FR-25 below.

**Trend widgets (FR-25):** `metric.trend(label)` with an aggregate, as other widgets, and a required `date()`.

- **API:** `.date(column)` (required: a trend without it isn't a `ScreenWidget`, so it fails `tsc`, and boot refuses it), `.by('hour' | 'day' | 'week' | 'month')`, `.bars()`, `.compare()` (off by default), `.format()`, `.where()`, `.width()` (default 4), `.lowerIsBetter()`.
- **Buckets:** without `by()`, from the range (`bucketFor()`): `today` → hour; `7d`, `30d`, `90d`, `month` → day; `quarter` → week; `year` → month. A date column has no hours, so it counts days instead. Boundaries come from Luxon in the admin's timezone (`bucketBounds()`): the first bucket starts at the start of the unit holding the range's start (weeks on Monday), and buckets follow until one reaches the range's end. Days, weeks and months are calendar steps, so a day across a clock change is 23 or 25 hours; hours are steps of 60 real minutes, so the skipped hour has no bucket and the repeated one has two (labelled with their zones).
- **The 100-bucket limit:** a `by()` that always needs more than 100 buckets in one of the screen's ranges (hours over 7 days or more) is a boot error; one that can (days over a year) is an `azu:doctor` error, and when it happens the card says "More than 100 days in this range: choose a shorter range". Following the range never needs more than 92.
- **Query:** one per period. The resource's query hook, `where()` and the range as for every widget, then `CASE WHEN col < b1 THEN 0 WHEN col < b2 THEN 1 … ELSE n-1 END`, with the boundaries as bound values in the form the column stores them (`databaseDateTime()`, or dates for a date column), grouped by that index, with the aggregate. No dialect date functions and no timezone tables. Missing buckets are 0; values are exact decimal strings at the column's scale. With `compare()`, the previous period's buckets are computed the same way from its own start and aligned by position.
- **Data:** `{ unit, chart, buckets: { start, end, value, previous, previousStart, previousEnd, href }[], total, previousTotal, noun }`. A day, week or month bucket's `href` is the list filtered to it (the resource's `dateRange` filter on the column, clipped to the range), when the resource has that filter; hours never link.
- **Chart (`TrendChart`, hand-written SVG, no dependency):** a 2px line in the brand colour with a light area under it, or bars with rounded tops on the zero baseline and a 2px gap; the previous period as a muted dashed line, with a two-entry legend and never a second y-axis. The y axis starts at 0 with 3 or 4 round steps (`niceTicks()`), labelled compactly in the widget's format, with the same currency display as the cards and the tooltip (`compactValue()` and `formatDecimal()` share `formatOptions()`: "NGN 80K" beside "NGN 80,000.00"), over recessive gridlines. The x axis shows 4 to 7 labels at an even step, fewer when they wouldn't fit (`axisTicks()`), so they never overlap. Labels and shapes are computed in `@mezielabs/azu/shared` (`bucketLabels()`, `axisLabel()`, `trendShapes()`, `bucketAt()`); dates are formatted with `Intl` in the admin's timezone.
- **Interaction:** the plot is one tab stop (`role="group"`, `aria-roledescription="chart"`). Hover or focus shows a crosshair and a tooltip with the bucket ("Wed 14 Oct", "14:00–15:00", "Week of 12 Oct", "October 2026"), its value and the previous period's, naming its own bucket ("Previous (Wed 16 Sep): NGN 20,500.00", from `previousStart`/`previousEnd` and `previousLine()`); arrow keys move between buckets, Home and End jump to the ends, Escape hides it, and a polite live region reads the active bucket in the tooltip's words. Clicking or pressing Enter on a bucket with an `href` opens it. The SVG is `role="img"` with a summary (total, highest bucket, previous total). "View as table" (a pressed toggle) shows the buckets as a table.
- **Empty:** all zero draws the flat line on the baseline and says "No <resource label> in this range".
- **Demo:** "Revenue over time" on the Overview, with `compare()`, across the grid under the four values. The Overview offers 90 days and the year too, so its trend shows day, hour and month buckets.

**Home (FR-22):** `home?: string | { resource: string }` in `config/azu.ts`. A screen name renders that screen at `<path>/` with the URL unchanged; `{ resource }` redirects (302) to its list for a user who passes that resource's `viewList` (`allows()`, failing closed). A user who fails the home screen's ability, or the home resource's `viewList`, gets the welcome page (`azu/dashboard`), not a 403 or a redirect to one. A `home` naming no registered screen or resource is a boot error, checked in the provider's `ready()` hook after `start/azu.ts` has run, and reported by `azu:doctor`. Without `home`, `<path>/` is the welcome page as before.

**URL state:** search, sort, filters, page, and page size are query parameters: `search`, `sort` and `direction` (`asc`/`desc`), `page`, `perPage` (10, 25, 50 or 100; defaults to `perPage` in `config/azu.ts`), and one parameter per filter (§5). Defaults are left out of the URL. Invalid values fall back to defaults, sorting only accepts sortable columns, and a page past the end redirects to the last page. Parsing, URLs and cell formatting live in `@mezielabs/azu/shared`, plain TypeScript the server and front ends share (non-negotiable 11). Inertia partial reloads refresh only the `list` prop; the shared `azu` props are lazy, so a reload doesn't rebuild the navigation.

**Form page (layout 4/4):** the create and edit pages keep the header and the form to a 760px reading width.

- **Fields:** one panel, in declared order. Short fields are half width and sit side by side in pairs once the form is at least 32rem wide (a container query); others take the row. `fieldWidth()` decides: `number`, `decimal`, `date`, `datetime`, `select`, `boolean` and `belongsTo` are short, and so is `text` with a validator `maxLength` of 80 or less (a SKU, not a name). A field with its own component is sized by its kind.
- **Currency:** a `number` or `decimal` field without a prefix of its own borrows the currency code of the list column with the same name (`column.decimal('price').format('currency', 'NGN')` gives the price input an `NGN` prefix), set on the server in `formFields()`.
- **Save bar:** sticky at the bottom of the window, across the page: a status (`formStatus()`: "Unsaved changes", "1 field needs attention", or both) in a `role="status"` region, then Cancel, a secondary button and the primary one. The count is the fields showing a server error; editing a field clears its own. The bar keeps one line at every width: the status truncates (its full text in a tooltip), and on phones the secondary labels shorten and every button is 44px. On phones, while a form's save bar is on the page, toasts sit above it rather than over its buttons; this applies to screen forms too.
- **Save and come back:** a hidden `_after` input (`afterSave()` in shared) picks where a successful save goes. It's read by the controller only: it never reaches the validator or the model.
  - **Create form:** Cancel, "Create & add another" (`_after=create`, secondary; "Add another" on phones) and "Create" (primary). With `create`, the save redirects to a fresh create form, with declared defaults only, scrolled to the top and focused on the first field. A toast says "<Singular> created", with a View link to the new record. The controller flashes its id and title only when the user passes that record's `view` (`allows()`, failing closed), and the create page gets them as `saved`. Otherwise `saved` is `null` and the toast has no link: when the user may create but not view, or without session middleware.
  - **Edit form:** Cancel, "Save & keep editing" (`_after=edit`; "Keep editing" on phones) and "Save changes". With `edit`, the save redirects back to the edit form, which shows the values as stored (sanitised rich text, stored file keys, synced relations). The toast says "<Singular> saved", the status clears, and focus stays on the button.
  - **Values:** create accepts `show` or `create`, edit accepts `show` or `edit`, and anything else, forged or unknown, means `show`, the detail page. The secondary button isn't a submit button, so Enter in a field saves with the primary one.
  - **Errors:** a validation error keeps the form's input and errors whichever button was used (`preserveState: 'errors'`), and the redirects pass the unsaved-changes guard, since they belong to the form's own submit.
- **Rich text:** the toolbar's buttons are icons (B, I, H, then the lists and quote after a divider), each named by `aria-label` and a tooltip, with `aria-pressed` for the current formatting; 44px on touch screens.

**Records:** clicking a list row opens its detail page when the policy's `view` allows it; selection stays on the checkboxes. Forms render required markers and limits (lengths, `min`/`max`/`step`, enum choices) from the operation's validator (§4). Leaving a create or edit form with unsaved changes asks first. Any Inertia visit away (the sidebar, a breadcrumb, Cancel, Sign out) opens a "Leave without saving?" dialog, Stay (focused) or Leave; Leave replays the visit, method and data included. Reloads and closing the tab get the browser's own `beforeunload` prompt. The form's own submit never asks, and neither does the redirect after a successful save; with nothing changed there's no question. An invalid submit keeps the changes and the guard. The browser's back button between admin pages can't be intercepted. Toasts appear in Azu's own `aria-live` region, rendered once beside the Inertia app so they survive the page change after a save.

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
// config/azu.ts
import { defineConfig } from '@mezielabs/azu'

export default defineConfig({
  path: '/admin',
  guard: 'web',
  loginUrl: '/login',
  // The account menu's "View site" link; false hides it
  siteUrl: '/',
  brand: { name: 'Acme', logo: '/images/logo.svg', color: '#2563eb' },
  perPage: 25,
  defaultDisk: 's3',
  // IANA name; defaults to the server process's timezone (TZ)
  timezone: 'Africa/Lagos',
  resources: { autoload: 'app/admin/resources' },
  // Custom screens (FR-20); false to register them in start/azu.ts
  screens: { autoload: 'app/admin/screens' },
  // What <path>/ shows (FR-22): a screen's name, or { resource: 'orders' }
  home: 'overview',
  navigation: {
    groups: ['Sales', 'Catalog'],
    // Links to any URL (FR-21); an ability only hides one
    links: [{ label: 'Help', url: 'https://docs.example.com', group: 'Help' }],
  },
  // Optional; must match azu({ entry }) in vite.config.ts
  entry: 'inertia/admin/app.tsx',
})
```

`path` can't be `/`; `defineConfig` throws so the panel never replaces the app's homepage. `siteUrl` (default `/`) is a path or URL, or `false` to hide View site; pages get it as `azu.siteUrl` (`null` when hidden). `brand.color` must be a hex colour (`#2563eb` or `#26e`); anything else throws. `brand` defaults to `{ name: 'Admin', color: '#2563eb' }` with no logo.

## 10. Testing

- **Unit (Japa):** every builder; generator column mapping; ability resolution.
- **Integration (Japa API client):** each controller against the demo app on Postgres, MySQL, SQLite, with a forbidden-path test for every policy method.
- **Browser (Japa browser client):** install to first resource, create/edit with validation errors, a bulk action, dark mode.
- **Performance:** seeded 100,000-row table against the 200 ms p95 target, run before each release.
- **Accessibility:** automated axe checks (axe-core, WCAG 2.1 A and AA) on core pages in CI, in the demo's browser suite (`tests/browser`), with popovers, menus and dialogs open as well as closed, in the light and dark themes. One exception: while a React Aria popover is open, `aria-hidden-focus` is off for that scan (see `docs/decisions.md`).

## 11. Milestones

| Phase | Scope | Exit criteria |
| --- | --- | --- |
| 0. Spike (2–3 days) | Monorepo skeleton, demo app, and three risk checks (below) | Written findings in `docs/spike-findings.md`; owner approves Phase 1 (approved 2026-10-12) |
| 1. Weeks 1–3 | FR-01 to FR-08: install, access gate, resources, generator, list/forms/detail, core fields, belongsTo/hasMany | Generated Product resource works end to end in the demo app |
| 2. Weeks 4–5 | FR-10 to FR-14: VineJS, Bouncer, Drive uploads, actions, filters, theming | Permission and validation tests pass; v0.x preview published |
| 3. Week 6 | Docs, quickstart, demo polish, v1.0 release | README quickstart works on a fresh app in under five minutes |
| v1.1 | P1 items: FR-09, FR-15, FR-16, FR-17. Private Drive disks: `file` and `image` URLs signed through Drive (`getSignedUrl`) instead of `getUrl`, which only suits public disks | |

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

**P1 planning note (2026-10-15, not started).** Phase 2's P0 items are FR-12, FR-13 and FR-14. These are the P1 items, in the suggested order, for Chimezie to approve before any of them starts:

1. **FR-16, navigation groups, icons and order.** The smallest of the four. `group` and `icon` are already on resources and in the navigation props; what's missing is an `order` (for groups and items) and rendering icons from a fixed set. It changes only the navigation. A quick, low-risk start that every admin sees.
2. **FR-09, `manyToMany` picker.** Builds on what FR-08 and FR-13 settled: the async ComboBox, the policy-checked options endpoint and its `viewList` rule. New work: a multi-select control, and pivot writes (`sync`) in the save transaction, after validation, limited to the declared field. It also takes `manyToMany` out of the "left out of forms" note in §5.
3. **FR-17, bulk actions on all filtered rows.** Needs FR-12's action runner and FR-13's `applyFilters`, both in place now. New work: "Select all N matching" in the bulk toolbar, then running the action over the filtered query in chunks of 500, a transaction per chunk, with the per-record policy check and skip report kept. It raises questions to settle first: how partial success across chunks is reported, and what happens to rows that change between chunks. (Settled in `docs/decisions.md`, 2026-10-16.)
4. **FR-15, component overrides and `azu:publish`.** (Built 2026-10-16.) Last, because publishing a page freezes its contract in the app's copy: the later the pages settle (after FR-09's and FR-17's UI changes), the less drift `azu:doctor` has to report. Field component swaps (`component()`) already work; this adds column and page overrides, the publish command and drift detection.

## 12. Open technical questions

- Does the free core include read-only CSV export? (Currently Pro.)
- Design the React component contract so a Vue front end can follow later without changing resource definitions.
- ~~Which headless component library and rich text editor version to standardise on.~~ Closed 2026-10-12: React Aria Components (including its table) and Tiptap 3 as a lazily loaded optional peer, pending the week-one check in §11. See `docs/decisions.md`.
