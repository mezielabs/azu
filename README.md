# Azu

**The back of your AdonisJS app.**

Azu is an admin panel for AdonisJS 7. It reads the models, policies, and validators you already wrote, then gives you a back office your team or client can use the same day.

*Azụ* is Igbo for "back". It's the part of your app your users never see, and the part your team lives in.

> [!NOTE]
> **Azu is pre-release.** This README describes the planned v1 API, and it will change based on feedback. If you'd use Azu on a real project in the next few months, [tell us about it](https://github.com/mezielabs/azu/discussions). Early testers get preview builds from week three.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./docs/screenshots/list-dark.png">
  <img alt="Azu's product list in the demo store: search, filters, thumbnails, prices, status badges and stock levels" src="./docs/screenshots/list-light.png">
</picture>

---

## Why Azu

Every client app eventually needs an admin. You can hand-build one, which means writing the same tables, forms, filters, and permission checks on every project. Or you can bolt on a generic tool that has its own config, its own permissions, and its own validation, which slowly drift away from your app's real rules.

Azu takes a different route. It doesn't add a second set of rules. It uses the ones you already have:

- **Lucid models** for data and relationships
- **Bouncer policies** for who can see and do what
- **VineJS validators** for form rules and error messages
- **Drive** for file and image uploads
- **Inertia and React** for the UI, so every page and field is a component you can replace

If your API rejects a request, Azu rejects it too. There's one source of truth, and it's your code.

## Requirements

- AdonisJS 7 with Lucid, Auth, and Bouncer
- Inertia with React
- Node.js 24.21 or later
- PostgreSQL, MySQL, or SQLite

## Installation

Azu's access gate is a Bouncer ability. The AdonisJS starter kits don't include Bouncer, so add it first if your app doesn't have it:

```sh
node ace add @adonisjs/bouncer
```

Then install and configure Azu with one command:

```sh
node ace add @mezielabs/azu
```

This registers the provider, creates `config/admin.ts`, mounts the panel at `/admin`, and adds a separate Vite entry so your public pages don't load any admin code.

It also adds an `accessAdmin` ability to `app/abilities/main.ts`. It returns `false` by default, so nothing is exposed until you decide who gets in:

```ts
// app/abilities/main.ts
import { Bouncer } from '@adonisjs/bouncer'
import type User from '#models/user'

export const accessAdmin = Bouncer.ability((user: User) => {
  return user.role === 'admin' || user.role === 'staff'
})
```

The starter kits' `User` model has no `role` column, and their signup page is public, so don't let every signed-in user in. While you try Azu on a fresh app, let yourself in by email, and narrow it before the app goes anywhere:

```ts
export const accessAdmin = Bouncer.ability((user: User) => {
  return user.email === 'you@example.com'
})
```

If you added Azu before Bouncer, run `node ace add @adonisjs/bouncer`, then `node ace configure @mezielabs/azu` to add the ability. Without Bouncer, Azu denies everyone.

Note: Azu uses your app's existing auth guard. Guests are redirected to your login page, and signed-in users who fail `accessAdmin` get a 403.

## Quick start

Generate a resource from an existing model (on a fresh starter kit, try `User`):

```sh
node ace make:admin-resource Product --policy
```

Azu reads the model's columns, casts, and relationships, then writes `app/admin/resources/product_resource.ts`, plus a create and update validator derived from the model's columns. The validator goes in `app/validators/product.ts`, or `product_admin.ts` if you already have that file; pass `--no-validator` to skip it. `--policy` writes `app/policies/product_policy.ts` if Product doesn't have a policy yet. It lets everyone who can open the admin panel list, view, create and update products, and it has no delete method; narrow it to your roles. Start your dev server and open `/admin`. You'll see a Products page with a list, search, and create, edit, and detail screens.

The generated resource is a starting point. Open it and adjust what's wrong.

## Resources

A resource is one file that points at a Lucid model and borrows its policy and validators:

```ts
// app/admin/resources/product_resource.ts
import { defineResource, column, field, filter } from '@mezielabs/azu'
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
    column.decimal('price').format('currency', 'NGN').sortable(),
    column.belongsTo('category', 'name'),
    column.badge('status').colors({ draft: 'gray', published: 'green' }),
  ],

  fields: [
    field.text('name'),
    field.text('sku'),
    field.decimal('price').min(0),
    field.belongsTo('category').searchable('name'),
    field.manyToMany('tags').searchable('name'),
    field.select('status').options({ draft: 'Draft', published: 'Published' }),
    field.richText('description'),
    field.image('thumbnail').disk('s3').maxSize('2mb'),
  ],

  filters: [
    filter.select('status', { draft: 'Draft', published: 'Published' }),
    filter.belongsTo('category'),
    filter.dateRange('createdAt'),
    filter.custom('Low stock', (q) => q.where('stock', '<', 10)),
  ],
})
```

Resource definitions are typed against the model. A typo like `column.text('nmae')` fails `tsc`, not your client's demo.

The fields become the create and edit forms, checked by your validators:

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./docs/screenshots/form-dark.png">
  <img alt="The demo's product edit form: name, SKU, price, a category select, tags, status and a rich text description" src="./docs/screenshots/form-light.png">
</picture>

The list screen pages, sorts, searches and filters on the server, and keeps it all in the URL, so a reload, a bookmark or a shared link shows the same list. Relations shown in `belongsTo` columns are preloaded for you. Search uses `ILIKE '%term%'` on the `search` columns: on a large Postgres table, give those columns trigram indexes (`CREATE EXTENSION pg_trgm`, then `CREATE INDEX ... USING gin (name gin_trgm_ops)`), or every search scans the table.

Files in `app/admin/resources` load automatically and appear in the admin navigation, grouped by `group`, for users whose policy allows `viewList`. Prefer explicit registration? Turn off autoload in `config/admin.ts` and register resources in `start/admin.ts`:

```ts
// config/admin.ts
resources: { autoload: false },
```

```ts
// start/admin.ts
import azu from '@mezielabs/azu/services/main'
import productResource from '#admin/resources/product_resource'

azu.register(productResource)
```

### Navigation

The sidebar holds your brand, the dashboard and your resources, and at the bottom a "View site" link (to `/`), the signed-in user, the theme button and Sign out. Sign out posts to `/admin/logout`, which signs the user out of Azu's auth guard (`guard` in `config/admin.ts`) and sends them to your `loginUrl`. On screens narrower than 768px, a menu button in a top bar opens the sidebar as a drawer.

Resources without a `group` come first. Groups follow in the order you list in `config/admin.ts`, then any others alphabetically. Within a group, `order` sets a resource's place (lower first), and resources without one follow alphabetically:

```ts
// config/admin.ts
navigation: { groups: ['Sales', 'Catalog'] },
```

`icon` is a [Lucide](https://lucide.dev/icons) icon name in kebab case, like `'package'` or `'shopping-cart'`. Install `lucide-react` to show icons; without it, the navigation shows none. The `azu()` Vite plugin bundles only the icons your resources name, which it reads from `app/admin/resources`. If a resource sets `icon` in a way the plugin can't read, from a variable say, list the name in `azu({ icons: ['shopping-cart'] })`. An unknown name gives a warning at build time and shows no icon.

### Field types

| Field | Form control | Notes |
| --- | --- | --- |
| `text`, `textarea` | Input, auto-growing textarea | |
| `number` | Numeric input | For numeric attributes (integers, floats). Supports `min`, `max`, `step` |
| `decimal` | Numeric input | For decimal columns, which Postgres and MySQL return as strings. The value stays an exact string end to end and is formatted with `Intl.NumberFormat`, never converted through `Number`. Supports `min`, `max`, `step`. When the list column of the same name has a currency format, the input shows its code as a prefix (`NGN`) |
| `boolean` | Toggle | |
| `select` | Dropdown, or radios for four or fewer options | |
| `date`, `datetime` | Date picker | Uses the admin timezone: `timezone` in `config/admin.ts`, or your server's timezone if you don't set it |
| `richText` | Rich text editor | Sanitised on the server before your validator sees it, and again before it's shown. The editor is Tiptap, loaded only when a form needs it; install `@tiptap/react`, `@tiptap/pm` and `@tiptap/starter-kit`, or you get a plain HTML textarea |
| `file`, `image` | Drag-and-drop upload | Stored with Drive on `disk()` or `defaultDisk`. Size (`maxSize()`, default 5mb for images, 10mb for files) and type (`accept()`) are checked on the server from the file's contents. SVG and HTML are refused unless you `accept()` them. Your validator sees the stored file's key |
| `belongsTo` | Searchable select | Loads options as you type |
| `hasMany` | Table on the detail page | Shows the related resource's columns, except the `belongsTo` back to this record (a category's products table has no Category column) |
| `manyToMany` | Searchable picker that adds and removes related records | Submits the related records' keys (`tags` → `tagIds`). Read-only for users who can't list the related resource, and on edit when attachments fall outside the related resource scope or exceed 200 |

You won't find `required()` on any field. Azu reads that from your VineJS validator, so the form and the rules can't disagree.

## Permissions

Azu checks your resource's Bouncer policy on every request. A missing method means denied.

```ts
// app/policies/product_policy.ts
import { BasePolicy } from '@adonisjs/bouncer'
import type User from '#models/user'
import type Product from '#models/product'

export default class ProductPolicy extends BasePolicy {
  viewList(user: User) {
    return user.role !== 'guest'
  }

  view(user: User, product: Product) {
    return true
  }

  create(user: User) {
    return user.role === 'admin'
  }

  update(user: User, product: Product) {
    return user.role === 'admin' || product.ownerId === user.id
  }

  delete(user: User) {
    return user.role === 'admin'
  }

  publish(user: User) {
    return user.role === 'admin'
  }
}
```

Buttons, fields, and actions a user can't use are hidden in the UI, but hiding is a convenience. The server always checks the policy, so a crafted request gets the same answer as a click.

## Validation

Create and update forms submit through the validators named on the resource. Azu only passes declared fields to the validator, so mass assignment stays limited to what you listed.

A resource with no validator for an operation can't save, by design: Azu never writes input that hasn't been through one of your validators.

A `belongsTo` field submits its foreign key (`category` → `categoryId`), so your validator checks `categoryId`.

A `manyToMany` field submits the related records' keys under the relation's singular name plus `Ids` (`tags` → `tagIds`), so your validator checks an array:

```ts
tagIds: vine.array(vine.number().exists({ table: 'tags', column: 'id' })).optional(),
```

Picker and filter values use Lucid's configured relation key: `localKey` for `belongsTo`, `relatedKey` for `manyToMany`. Detail links still use the related record's primary key.

Azu syncs the pivot rows with the validator's output, in the same transaction as the save, so a failure rolls back both. Leave `tagIds` out of a request and the attached records stay as they are; send an empty list to detach them all. This also works when the form uploads a file: Azu transports an empty selection as the string `[]` and restores the array before validation.

When a related resource's `query` scope hides attached records, the edit form makes that picker read-only and explains why. The server checks the scope again on submission and ignores changes to that field, preserving the entire attachment set. Its current keys still reach the validator.

The edit form loads up to 200 attached records. For a record with more, it shows the field read-only with a note ("350 tags attached; too many to edit here") and leaves `tagIds` out, so saving the form never detaches the ones it didn't load. The server applies the same rule, so `tagIds` sent anyway is ignored, and doesn't reach your validator either.

Validation errors show up under the field that caused them, including nested and array fields like `tags.0`.

Note: validators written for your API don't always fit a form. If update needs different rules from create (an optional password, say), give the resource a separate `update` validator.

Some validators need context, such as an update validator whose `unique` rule has to skip the record being edited. Azu passes `{ record }` as VineJS metadata: the record being edited on update, `undefined` on create. If your validator expects a different shape, map it with `meta`, which receives the record and the HTTP context:

```ts
validators: {
  create: createProductValidator,
  update: updateProductValidator,
  meta: ({ record }) => ({ productId: record?.id }),
},
```

## Filters

Each filter is a URL query parameter named after it, so a filtered view can be bookmarked: `?status=published&category=3&createdAt=2026-10-01..2026-10-31&low-stock=1`. Filters combine with each other, with search and with sort, and changing one goes back to page 1.

- `filter.select(column, options)` and `filter.boolean(column)` match a column.
- `filter.dateRange(column)` takes whole days in the admin's timezone (`timezone` in `config/admin.ts`). Either end can be left open.
- `filter.belongsTo(relation)` picks a related record from a searchable list. It shows only to users who pass the related resource's `viewList`, like a `belongsTo` field.
- `filter.custom(label, query)` is an on/off filter with your own query, typed against the model. Its parameter is the label in kebab case (`low-stock`).

A filter can't be named after the list's own parameters (`page`, `perPage`, `sort`, `direction`, `search`), and values that don't fit a filter are ignored rather than failing the page.

## Actions

Actions are async functions. They run on a single row (from the list's row menu or the detail page), or on a selection of rows as a bulk action:

```ts
actions: [
  action.bulk('publish')
    .confirm('Publish the selected products?')
    .ability('publish')
    .handle(async (products, { trx }) => {
      await Product.query({ client: trx })
        .whereIn('id', products.map((p) => p.id))
        .update({ status: 'published' })

      return { message: `${products.length} products published` }
    }),

  action.row('restock')
    .ability('restock')
    .fields([field.number('quantity')], restockValidator)
    .handle(async (product, { input }) => {
      product.stock += input.quantity
      await product.save()
      return { message: `${product.name} now has ${product.stock} in stock` }
    }),
]
```

`.ability('publish')` checks the `publish` method on your policy for each record; without `.ability()`, an action checks `update`. In a bulk action, records the user can't touch are skipped and reported, rather than failing the whole batch.

Once every row on the page is selected, the bulk toolbar offers **Select all N matching**. The action then runs on every row the list's search and filters match, up to 10,000:

- **In chunks:** 500 records at a time, each chunk in its own transaction, with the same policy check per record. Your handler is called once per chunk, so it shouldn't assume it sees every record at once.
- **Partial success:** if a chunk fails, it rolls back and the run stops, but the chunks before it stay done. The confirm dialog says so before a run of more than 500, and the toast reports how many were done, skipped and not changed. Azu writes that toast, so a handler's `{ message }` isn't shown, and `{ redirect }` applies only when the whole run succeeds.
- **Running it again:** finished chunks stay done, so running the action again repeats it on those rows. Write handlers that are safe to run twice, or filter so done rows drop out (filter by status: draft before publishing, say).
- **Which rows:** the ones that matched when the run started. Rows added meanwhile are left out, and a row that no longer matches when its chunk runs is skipped. If more rows match than the count the user confirmed, nothing runs.
- **The limit:** with more than 10,000 matching rows, the action is refused before anything changes. Narrow the filters and run it on each part.

The handler runs in a transaction, with its records bound to it. Run your other queries through `trx` too, so that if the handler throws, all its changes roll back and the user sees an error toast. An AdonisJS `Exception` with a status below 500 shows its message; any other error shows a generic message and goes to your log.

`.fields()` asks for input in the action's dialog. The input goes through the validator you pass, like a form's, and the handler gets the validator's output as `input`. `.destructive()` styles the action like Delete. Return `{ message }` for a toast, or `{ redirect }` to go somewhere else.

To share an action between resources, generate it with `node ace make:admin-action Archive`, import it from `#admin/actions/archive` and add it to each resource's `actions`. Every resource that uses it needs the ability on its policy; `tsc` checks.

When the policy has a `delete` method, every resource gets a Delete row and bulk action, with a confirmation. It runs `beforeDelete` for each record, and deletes their stored files after the transaction commits.

## Customising

Azu gives you three levels of control. Start with the smallest one that works.

**1. Config.** Labels, icons, groups, page size, and branding live in the resource or in `config/admin.ts`. No React needed.

**2. Swap a component.** Point any field or column at your own React component:

```ts
field.text('sku').component('SkuInput'),
column.custom('stock', 'StockBar'),
```

```tsx
// inertia/admin/components/sku_input.tsx
import type { FieldProps } from '@mezielabs/azu-react'

export default function SkuInput({ field, value, onChange, errors }: FieldProps<string>) {
  return (
    <label className="azu-field">
      <span className="azu-label">{field.label}</span>
      <input
        className="azu-input"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        aria-invalid={errors.length > 0}
      />
      {errors.length > 0 && <span className="azu-field-error">{errors.join(' ')}</span>}
    </label>
  )
}
```

```tsx
// inertia/admin/components/stock_bar.tsx
import type { CellProps } from '@mezielabs/azu-react'

export default function StockBar({ value }: CellProps<number>) {
  const stock = value ?? 0
  return (
    <span style={{ color: stock < 10 ? 'var(--azu-danger)' : undefined }}>{stock} in stock</span>
  )
}
```

Components in `inertia/admin/components` are registered by file name, so `sku_input.tsx` becomes `SkuInput`. Each one loads only when a page that uses it opens, so they add nothing to the admin's initial JavaScript. A field component gets `FieldProps`: the `value`, `onChange`, the field's `errors`, the `field` itself and the form's other values as `record`. A cell gets `CellProps`: its `value`, the row as `record`, and the `column`. `.component()` works on every column kind, and `column.custom()` is a column with no formatting of its own.

**Slots.** To add something to a page without replacing it, name a component for one of a resource's slots:

```ts
export default defineResource(Product, {
  // ...
  slots: { beforeTable: 'LowStockNotice' },
})
```

```tsx
// inertia/admin/components/low_stock_notice.tsx
import { Link, type SlotProps } from '@mezielabs/azu-react'

export default function LowStockNotice({ path }: SlotProps) {
  return (
    <p>
      Running low?{' '}
      <Link href={`${path}?low-stock=1`}>Show products with fewer than 10 in stock</Link>
    </p>
  )
}
```

The slots are `header` (under the page title, on every page of the resource), `toolbar` (beside the page's own buttons), `beforeTable` (above the list) and `afterForm` (under the create and edit forms). A slot component gets `SlotProps`: the `resource`, the `page` (`index`, `create`, `edit` or `show`), the `record` on the edit and detail pages, and the resource's list URL as `path`.

**3. Publish a page.** Copy any page into your app and edit it however you like:

```sh
node ace admin:publish resource/index
```

This copies the page to `inertia/admin/pages/resource/index.tsx`, with a comment at the top recording the Azu version it came from. Page names are snake_case paths, like your app's own Inertia pages; the older `Resource/Index` spelling works too. Run `node ace admin:publish` without a page to list them. It won't replace a page you've already published unless you pass `--force`.

Azu renders your copy from then on. It's the most flexible option, but you now own that page through upgrades. Run `node ace admin:doctor` after upgrading to see which published files drifted from the new version.

## Theming

Set your brand once and Azu generates light and dark palettes from it:

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
  // Dates are entered and shown in this timezone. Defaults to the server's (TZ)
  timezone: 'Africa/Lagos',
})
```

`brand.name` (default `Admin`) shows at the top of the sidebar and in page titles, and `brand.logo` is an image shown before it (without one, a tile with the name's first letter). `brand.color` is a hex colour (default `#2563eb`). Azu uses it as is where it's readable. Where it isn't, it shifts only the colour's lightness, so the hue stays, until all text reaches WCAG AA (4.5:1) on each theme's backgrounds. A very light brand colour gets darkened on the light theme, for example. So the exact hex on screen may differ from `brand.color`, and from light mode to dark mode. Text on brand-coloured buttons is white or near-black, whichever reads.

Dark mode follows the user's system setting. The theme button at the bottom of the sidebar ("Switch to dark theme") overrides it, and this browser remembers the choice. Toggle back to your system's theme and Azu follows the system again.

The palettes are Azu's own CSS variables (`--azu-brand`, `--azu-surface`, `--azu-text` and so on), set on `<html>`.

## Commands

| Command | What it does |
| --- | --- |
| `node ace add @mezielabs/azu` | Installs and configures Azu |
| `node ace make:admin-resource <Model>` | Generates a resource from a model, plus a create and update validator in `app/validators` unless you pass `--no-validator`. Add `--policy` to create a policy when the model has none, or `--readonly` for list and detail only |
| `node ace make:admin-action <Name>` | Creates a reusable row action in `app/admin/actions`, or a bulk one with `--bulk`, with an ability, a confirmation and a handler that uses the action's transaction |
| `node ace admin:publish [page]` | Copies one of Azu's pages into `inertia/admin/pages` for editing, stamped with the version it came from. Without a page, lists them |
| `node ace admin:doctor` | Checks config, missing policy methods, validators that miss form fields, component names with no file, and published pages that drifted. Exits with 1 on an error |

## Azu Pro

The core is free and MIT licensed, and it always will be. Azu Pro adds the extensions clients tend to ask for once the basics work:

- **Dashboards** with value, trend, and chart widgets
- **Audit log** of every admin change, with before and after values
- **CSV import and export** with a validation preview before anything is saved
- **Impersonation** so support staff can see exactly what a user sees
- **Multi-tenancy** with automatic query scoping
- **Premium layouts and theme**

Pro is licensed per project or for unlimited projects, and is checked at install, never at runtime. A lapsed licence never takes down a production admin.

## Roadmap

- [ ] v0.x previews for early testers
- [ ] v1.0: resources, fields, relationships, permissions, validation, actions, filters, theming
- [ ] v1.1: bulk actions on all filtered rows, navigation badges, more override slots
- [ ] Azu Pro: dashboards and audit log first
- [ ] Vue support, if there's demand

## Contributing

Azu is early, so the most useful contribution right now is feedback on this API. Open a [discussion](https://github.com/mezielabs/azu/discussions) with what you'd change, or what your current admin does that this wouldn't.

## License

MIT. Built by [Mezie Labs](https://mezielabs.com).
