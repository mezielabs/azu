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
| FR-15 | Component overrides | Any field or column component can be swapped per resource; named slots on resource pages; `node ace admin:publish` copies pages for editing, stamped with their version; `node ace admin:doctor` reports drift | P1 |
| FR-16 | Navigation groups | Resources grouped, ordered, and given icons from the resource definition | P1 |
| FR-17 | Bulk action on all filtered rows | "Select all N matching" runs the action in chunks of 500 | P1 |
| FR-18 | Soft deletes | Trashed filter and restore action when the model uses soft deletes | P2 |
| FR-19 | Global search | Cmd/Ctrl+K palette searches every resource's title column | P2 |

**Out of scope for v1:** Vue or Svelte front ends, a visual no-code builder, ORMs other than Lucid, AdonisJS versions before 7, a plugin marketplace, replacing the app's auth, and all Pro features (dashboards, audit log, CSV import/export, impersonation, multi-tenancy, premium theme).

**Pro boundary:** Pro ships later as separate packages that plug into public core extension points. Design those extension points, but never import Pro code from core.

## 2. Non-functional requirements

| Area | Requirement |
| --- | --- |
| Performance | List page server response under 200 ms at p95 for 100,000 rows, 25 per page, on Postgres with indexed sort columns. No N+1: relations shown in columns are preloaded. Searches use `ILIKE '%term%'`, so on Postgres the search columns need trigram (`pg_trgm`) GIN indexes; a B-tree can't serve a leading wildcard. Measured 2026-10-13 on 100,000 demo products, Postgres 18, production mode, sequential requests: worst p95 40 ms across first page, sorts, a 101-match search, deep pages and 100 per page; 162 ms for a search matching every row. Without trigram indexes, search was 598 ms. Filters (FR-13), measured 2026-10-15 the same way: worst p95 47 ms for a filtered, sorted page (status, page 1,000 of 3,000, by price). Each filter alone, sorted, was 19–27 ms, and five combined with a search was 20 ms. Filters need no extra indexes at this size. Check with `pnpm bench:list` before each release. |
| Security | Every admin route and action authorises server-side, never only by hiding UI. CSRF on all writes. Mass assignment limited to declared fields. Uploads restricted by MIME type and size per field. |
| Accessibility | WCAG 2.1 AA on core screens: keyboard navigation, focus states, labelled inputs, 4.5:1 contrast in both themes. |
| Compatibility | AdonisJS 7, Node 24.21+ (earlier 24.x releases crash loading some dependencies, see docs/decisions.md), Inertia with React 19, Lucid on Postgres, MySQL, and SQLite. Latest two versions of Chrome, Firefox, Safari, Edge. |
| Type safety | Resource definitions typed against the model: a misspelled column or field name fails `tsc`. |
| Bundle | Admin JS loads only on `/admin` routes via a separate Vite entry; zero added weight on public pages. Budget, checked in CI against the demo's production build: ≤ 120 kB gz of initial admin JS (the admin entry and its static imports), ≤ 160 kB gz per page's lazy chunk (what a page loads beyond the initial JS), and ≤ 200 kB gz per optional-feature chunk (an `azu()` optional feature such as the Tiptap editor, loaded only when a form uses it; measured like a page, beyond the initial JS). |
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
| `richText` | Tiptap editor (optional peer, lazy; a plain HTML textarea without it). Sanitised on the server with `sanitize-html` to Tiptap StarterKit's markup, before validation and again before display | Hidden by default | HTML in text column |
| `file`, `image` | Drag-and-drop upload with preview. `maxSize()` (default 5mb image, 10mb file) and `accept()` (MIME types, wildcards allowed) checked on the server; the type comes from the file's signature where the format has one. Defaults: JPEG, PNG, WebP, GIF, AVIF for images, plus PDF, text, CSV, Office and ZIP for files; SVG and HTML only when accepted explicitly | File name or thumbnail | Drive disk (`disk()`, else `defaultDisk`, else Drive's default), key on the model |
| `belongsTo` | Searchable async select. Submits the relation's foreign key (`category` → `categoryId`), which the validator checks and errors use. Optional relations get a Clear button | Related title, linked | Foreign key |
| `hasMany` | Paginated table on the detail page, 10 rows a page, with the related resource's columns. Needs a resource for the related model | Count | Lucid relation |
| `manyToMany` | Searchable picker: the attached records as removable tags, plus a search that adds one at a time. Submits the related keys (`tags` → `tagIds`). Read-only without the related resource's `viewList`, and on edit past 200 attached | Not a list column yet | Lucid relation (pivot rows) |

Every field supports `label`, `help`, `placeholder`, `default`, `visibleOn('create' | 'edit')`, `readOnly`, `ability`, and `component`.

Forms and detail pages render `text`, `textarea`, `number`, `decimal`, `boolean`, `select`, `date` and `datetime` (FR-06), `belongsTo` (FR-08), and `richText`, `file` and `image` (FR-07). Detail pages show `hasMany` tables (FR-08). Forms and detail pages render `manyToMany` (FR-09).

Uploads (FR-07): an upload is checked first. If the save fails validation, nothing is stored. Otherwise it's stored on the disk under `<resource>/<field>/<uuid>.<ext>`, and the validator sees that key. Leaving a file field out of the request keeps the stored file; sending it empty removes it. A replaced or removed file is deleted from the disk after the save commits. URLs come from the disk's `getUrl()`, so private disks (signed URLs) aren't supported yet. Drive is an optional peer: a resource with file or image fields fails at boot without it.

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

**Auth:** `config/admin.ts` names the guard (default: app default) and `loginUrl` (default `/login`). The installer adds an `accessAdmin` ability to `app/abilities/main.ts` that returns `false`. If the app has no Bouncer yet, the installer doesn't install it (AdonisJS presets don't install their dependencies either); it explains how to add it, and the gate denies everyone until then.

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
4. Success redirects (303) to the detail page, and the form shows a toast. A validation failure renders the form again with a 422 and `errors`, keyed by path, and the form keeps what the user typed. Messages for paths no shown field covers, such as an attribute the resource doesn't declare as a field, appear in a summary at the top of the form.

Relations (FR-08):

- **`belongsTo` options** come from `GET /admin/resources/<name>/fields/<field>/options?search=…`, as JSON. It's gated like the form it serves: `create`, or `update` with the record named by `?record=<id>`, and the field must be on that form for the user (its `visibleOn` and `ability`, not `readOnly`). The user must also pass the related resource's `viewList`, failing closed: no resource for the related model, or no `viewList` on its policy, is a 403. Without it, the form shows the field read-only: the current record, no options, never written. It returns up to 20 records whose title attribute (`searchable()`, else the related resource's `title`) contains the search, literally, sorted by title, through the related resource's `query` hook when there is one.
- **`manyToMany` fields (FR-09)** submit the related records' keys under the relation's singular name plus `Ids` (`tags` → `tagIds`, `relatedProducts` → `relatedProductIds`), and the validator checks that array.
  - **Options:** they use the same options endpoint and rule as `belongsTo`. Without the related resource's `viewList`, the field is read-only: it shows the attached records, offers no options (403), and is never written. On edit, its current keys reach the validator, up to 200.
  - **Writes:** the validator's array replaces the attached records through Lucid's `sync`, repeated keys counted once. The sync runs after `save()` and before `afterSave`, in the save's transaction, so any failure rolls back the record and its pivot rows together. A request without the key leaves them as they are, and an empty array detaches them all.
  - **Display:** the form and the detail page show up to 200 attached records, by title, through the related resource's `query` hook, each linked when the user may `view` it.
  - **Past 200:** an edit form for a record with more than 200 attached (counted from the pivot rows, unscoped) shows the field read-only, with `readOnlyReason` ("350 tags attached; too many to edit here") under it, and no options (403). The form doesn't send the key, and the server never syncs it or passes it to the validator, so a save can't detach the records the form didn't load.
- **`hasMany` tables** show only when the user passes the related resource's `viewList`. They use the related resource's columns, `query` hook and preloads, and check `view` per row for links. Each table's page is a query parameter (`productsPage`), and paging is a partial reload of `relations`.

Forms submit to their own URL: `POST /admin/resources/<name>/create` and `PUT /admin/resources/<name>/<id>/edit`. A 422 then leaves the address bar on the form. An id that can't exist, such as `abc` for an integer key, is a 404.

## 7. Commands

| Command | Behaviour |
| --- | --- |
| `node ace add @mezielabs/azu` | Registers provider, writes `config/admin.ts` and `start/admin.ts` (registered as a preload, with a `#admin/*` import alias), adds `accessAdmin` (when Bouncer is set up; otherwise explains how to add it), mounts routes at `/admin`, writes the admin Vite entry (`inertia/admin/app.tsx`) and adds the `azu()` plugin from `@mezielabs/azu/vite` to `vite.config.ts`, installs `@mezielabs/azu-react` (`--install`/`--no-install`, prompts otherwise) |
| `node ace make:admin-resource <Model>` | Introspects columns, casts, relations; writes `app/admin/resources/<model>_resource.ts` and, by default, a create/update validator in `app/validators/<model>.ts` derived from the model's columns (see below), named in the resource's `validators`. Flags: `--no-validator` (skip the validator), `--policy`, `--readonly` (no forms, so no validator) |
| `node ace make:admin-action <Name>` | Writes `app/admin/actions/<name>.ts` from a stub: a row action (`--bulk` for bulk) built with `action.row()`, named and with its ability in camelCase (`MarkAsPaid` → `markAsPaid`), a `confirm`, and a handler that saves through `trx`. Refuses `delete` and won't overwrite without `--force`. Exported as the file's default, so any resource can list it; `tsc` checks the ability against each resource's policy |
| `node ace admin:publish [page]` | Copies one of Azu's pages from the installed `@mezielabs/azu-react` (which ships `src/pages`) into `inertia/admin/pages`. Page names are snake_case (`resource/index` → `inertia/admin/pages/resource/index.tsx`); `Resource/Index` and `azu/resource/index` are accepted too. The copy starts with a stamp: `// azu-publish: resource/index@<version> sha256:<hash of the original>`. It refuses to replace an existing file without `--force`. No argument lists the pages, marking published ones. Pages only: Azu's own components aren't resolved from the app, so a copied one would never render |
| `node ace admin:doctor` | Boots the app and checks: config that points at missing things (the `guard` in config/auth.ts, upload disks in config/drive.ts, the Vite `entry`, the `azu()` plugin in vite.config.ts, the autoload directory, no resources); policy methods resources rely on (`viewList`, `view`, `create`/`update` with form fields, a field's `ability`; an action's ability is an error, since the action can never run); form fields whose input the create or update validator doesn't declare (errors, since VineJS drops them); component names from fields, columns and slots that no file in `inertia/admin/components` registers, and two files registering one name; and published pages whose original changed (a stamp hash that no longer matches the installed page), unstamped pages, and pages Azu doesn't have. Errors exit with 1; warnings and notes don't |

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

1. **Config:** labels, icons, colours, page size in the resource or `config/admin.ts`.
2. **Component swap:** `field.text('sku').component('SkuInput')`, `.component()` on any column, or `column.custom('stock', 'StockBar')` resolves a React component from `inertia/admin/components`, registered by file name (`sku_input.tsx` → `SkuInput`, `componentName` in `@mezielabs/azu/shared`). Field components receive `value`, `onChange`, `field`, `errors`, `record` (`FieldProps<T>`); cells receive `value`, `record` (the row) and `column` (`CellProps<T>`). The contracts are defined in `@mezielabs/azu` and re-exported from `@mezielabs/azu-react`, so `import type { FieldProps } from '@mezielabs/azu-react'` works. A name with no registered component falls back to Azu's own control or cell.
3. **Page publish:** `admin:publish resource/index` copies the page to `inertia/admin/pages/resource/index.tsx`; Azu renders the app's copy. `Resource/Index` is accepted too. Package pages import only from `@mezielabs/azu-react` and `@mezielabs/azu/*`, never by relative path, so the copy compiles in the app unchanged.

**Slots (FR-15)** cover cases between levels 2 and 3. A resource's `slots` option names a registered component for each slot: `slots: { beforeTable: 'LowStockNotice' }`. The schema carries all four (`header`, `toolbar`, `beforeTable`, `afterForm`), `null` when unset.

- `header`: under the page title, on the list, create, edit and detail pages.
- `toolbar`: in the page header, before the page's own buttons (New, the detail page's actions and Edit), on the same four pages.
- `beforeTable`: on the list, above the bulk toolbar and the table.
- `afterForm`: under the create and edit forms.

A slot component receives `SlotProps`: `resource`, `page` (`index`, `create`, `edit`, `show`), `record` (`{ id, title }` on edit and detail, else `null`) and `path` (the resource's list URL). Unset, or naming no registered component, a slot renders nothing; `admin:doctor` reports the second case. `<Slot>` is exported, so published pages keep their slots. The dashboard and error pages have no slots; publish them instead.

**Theming (FR-14):** CSS variables generated from one `brand.color`, with light and dark palettes. Dark mode follows the OS with a remembered toggle.

- **Palettes:** `palette(color, theme)` in core (`src/theme`, plain TypeScript, no dependency) gives Azu's own variables (non-negotiable 9): neutrals (`surface`, `subtle`, `text`, `muted`, `border`), brand (`brand` for text and accents, `brand-solid` and `on-brand` for filled areas), danger, success, and a background and text pair for each badge colour (gray, green, blue, red, yellow).
- **Contrast:** every text pair reaches WCAG AA, 4.5:1, for any brand colour. `brand` is the configured colour with only its OKLCH lightness moved as far as 4.5:1 against `surface` and `subtle` needs, so the hue stays. `on-brand` is white or near-black, falling back to black on the mid-tones where near-black misses. A unit test tries fifteen brand colours, from white to black, in both themes.
- **Delivery:** the root view inlines the palettes as a `<style>`, built once at boot. Light is the default; dark applies under `prefers-color-scheme: dark` unless `data-azu-theme="light"` is on `<html>`, or when it's `"dark"`. A boot script sets that attribute from `localStorage` (`azu-theme`) before the first paint. Both carry Shield's CSP nonce. The stylesheet keeps the default brand's palettes as zero-specificity fallbacks.
- **Toggle:** the header's "Dark theme" button (`aria-pressed`) stores the other theme, or clears the stored choice when the other theme is the OS's, so the admin follows the OS again.
- **Name and logo:** `brand.name` (default `Admin`) heads the header and page titles (`Products · Acme`). `brand.logo` is a decorative image beside it. Pages get them as `azu.brand`.
- **Checks:** the axe scans (§10) run in both themes.

**Navigation (FR-16):** built per request from the resources the user may `viewList`. Ungrouped resources come first. Groups follow `navigation.groups` in `config/admin.ts`, then any others by label. Within a group, resources follow `order` (lower first), then those without one, by label.

- **Icons:** `icon` is a Lucide icon name in kebab case. `lucide-react` is an optional peer of `@mezielabs/azu-react`, and without it the navigation has no icons.
- **Bundling:** `@mezielabs/azu-react/icons` is an empty map that the `azu()` Vite plugin replaces with a generated module. The plugin reads the resource files (`resources`, default `app/admin/resources`, plus its `icons` option) for `icon:` names, and imports one file per icon in use, so the bundle holds no others.
- **Unknown names and dev:** an unknown name is a build warning and renders nothing. In dev, an edit that changes the icons in use reloads the admin.
- **Agnostic plugin:** the front-end package's manifest (`azu.icons`) names the icon package and file pattern, so `azu()` knows nothing of React or Lucide.
- **Accessibility:** icons are decorative (`aria-hidden`); the link's label names it.

**URL state:** search, sort, filters, page, and page size are query parameters: `search`, `sort` and `direction` (`asc`/`desc`), `page`, `perPage` (10, 25, 50 or 100; defaults to `perPage` in `config/admin.ts`), and one parameter per filter (§5). Defaults are left out of the URL. Invalid values fall back to defaults, sorting only accepts sortable columns, and a page past the end redirects to the last page. Parsing, URLs and cell formatting live in `@mezielabs/azu/shared`, plain TypeScript the server and front ends share (non-negotiable 11). Inertia partial reloads refresh only the `list` prop; the shared `azu` props are lazy, so a reload doesn't rebuild the navigation.

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

`path` can't be `/`; `defineConfig` throws so the panel never replaces the app's homepage. `brand.color` must be a hex colour (`#2563eb` or `#26e`); anything else throws. `brand` defaults to `{ name: 'Admin', color: '#2563eb' }` with no logo.

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
4. **FR-15, component overrides and `admin:publish`.** (Built 2026-10-16.) Last, because publishing a page freezes its contract in the app's copy: the later the pages settle (after FR-09's and FR-17's UI changes), the less drift `admin:doctor` has to report. Field component swaps (`component()`) already work; this adds column and page overrides, the publish command and drift detection.

## 12. Open technical questions

- Does the free core include read-only CSV export? (Currently Pro.)
- Design the React component contract so a Vue front end can follow later without changing resource definitions.
- ~~Which headless component library and rich text editor version to standardise on.~~ Closed 2026-10-12: React Aria Components (including its table) and Tiptap 3 as a lazily loaded optional peer, pending the week-one check in §11. See `docs/decisions.md`.
