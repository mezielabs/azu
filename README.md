# Azu

**The back of your AdonisJS app.**

Azu is an admin panel for AdonisJS 7. It reads the models, policies, and validators you already wrote, then gives you a back office your team or client can use the same day.

*Azụ* is Igbo for "back". It's the part of your app your users never see, and the part your team lives in.

> [!NOTE]
> **Azu is pre-release.** This README describes the planned v1 API, and it will change based on feedback. If you'd use Azu on a real project in the next few months, [tell us about it](https://github.com/mezielabs/azu/discussions). Early testers get preview builds from week three.

<!-- Screenshot: replace with a real capture once the demo app exists -->
![Azu product list in light mode](./docs/screenshot.png)

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

Install and configure Azu with one command:

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

If your app doesn't use Bouncer yet, run `node ace add @adonisjs/bouncer` first, then `node ace configure @mezielabs/azu`. Without Bouncer, Azu denies everyone.

Note: Azu uses your app's existing auth guard. Guests are redirected to your login page, and signed-in users who fail `accessAdmin` get a 403.

## Quick start

Generate a resource from an existing model:

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
    field.select('status').options({ draft: 'Draft', published: 'Published' }),
    field.richText('description'),
    field.image('thumbnail').disk('s3').maxSize('2mb'),
  ],

  filters: [
    filter.select('status', { draft: 'Draft', published: 'Published' }),
    filter.dateRange('createdAt'),
    filter.custom('Low stock', (q) => q.where('stock', '<', 10)),
  ],
})
```

Resource definitions are typed against the model. A typo like `column.text('nmae')` fails `tsc`, not your client's demo.

The list screen pages, sorts and searches on the server, and keeps it all in the URL, so a reload or a shared link shows the same list. Relations shown in `belongsTo` columns are preloaded for you. Search uses `ILIKE '%term%'` on the `search` columns: on a large Postgres table, give those columns trigram indexes (`CREATE EXTENSION pg_trgm`, then `CREATE INDEX ... USING gin (name gin_trgm_ops)`), or every search scans the table.

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

### Field types

| Field | Form control | Notes |
| --- | --- | --- |
| `text`, `textarea` | Input, auto-growing textarea | |
| `number` | Numeric input | For numeric attributes (integers, floats). Supports `min`, `max`, `step` |
| `decimal` | Numeric input | For decimal columns, which Postgres and MySQL return as strings. The value stays an exact string end to end and is formatted with `Intl.NumberFormat`, never converted through `Number`. Supports `min`, `max`, `step` |
| `boolean` | Toggle | |
| `select` | Dropdown, or radios for four or fewer options | |
| `date`, `datetime` | Date picker | Uses the admin timezone: `timezone` in `config/admin.ts`, or your server's timezone if you don't set it |
| `richText` | Rich text editor | Sanitised on the server before your validator sees it, and again before it's shown. The editor is Tiptap, loaded only when a form needs it; install `@tiptap/react`, `@tiptap/pm` and `@tiptap/starter-kit`, or you get a plain HTML textarea |
| `file`, `image` | Drag-and-drop upload | Stored with Drive on `disk()` or `defaultDisk`. Size (`maxSize()`, default 5mb for images, 10mb for files) and type (`accept()`) are checked on the server from the file's contents. SVG and HTML are refused unless you `accept()` them. Your validator sees the stored file's key |
| `belongsTo` | Searchable select | Loads options as you type |
| `hasMany` | Table on the detail page | |
| `manyToMany` | Searchable picker | |

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

## Actions

Actions are async functions. They run on a single row, or on a selection of rows as a bulk action:

```ts
actions: [
  action.bulk('publish')
    .confirm('Publish the selected products?')
    .ability('publish')
    .handle(async (products) => {
      await Product.query()
        .whereIn('id', products.map((p) => p.id))
        .update({ status: 'published' })

      return { message: `${products.length} products published` }
    }),
]
```

`.ability('publish')` checks the `publish` method on your policy. In a bulk action, records the user can't touch are skipped and reported, rather than failing the whole batch. If the handler throws, its changes roll back and the user sees the error.

## Customising

Azu gives you three levels of control. Start with the smallest one that works.

**1. Config.** Labels, icons, groups, page size, and branding live in the resource or in `config/admin.ts`. No React needed.

**2. Swap a component.** Point any field or column at your own React component:

```ts
field.text('sku').component('SkuInput')
```

```tsx
// inertia/admin/components/sku_input.tsx
import type { FieldProps } from '@mezielabs/azu-react'

export default function SkuInput({ value, onChange, errors }: FieldProps<string>) {
  return (
    <input
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value.toUpperCase())}
      aria-invalid={errors.length > 0}
    />
  )
}
```

Components in `inertia/admin/components` are registered by file name, so `sku_input.tsx` becomes `SkuInput`.

**3. Publish a page.** Copy any page into your app and edit it however you like:

```sh
node ace admin:publish resource/index
```

This copies the page to `inertia/admin/pages/resource/index.tsx`. Page names are snake_case paths, like your app's own Inertia pages; the older `Resource/Index` spelling works too.

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

Dark mode follows the user's system setting, with a toggle in the panel.

## Commands

| Command | What it does |
| --- | --- |
| `node ace add @mezielabs/azu` | Installs and configures Azu |
| `node ace make:admin-resource <Model>` | Generates a resource from a model, plus a create and update validator in `app/validators` unless you pass `--no-validator`. Add `--policy` to create a policy when the model has none, or `--readonly` for list and detail only |
| `node ace make:admin-action <Name>` | Creates a reusable action class |
| `node ace admin:publish [page]` | Copies a page or component into your app for editing |
| `node ace admin:doctor` | Checks config, missing policy methods, and drifted published files |

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
