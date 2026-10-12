# Phase 0 spike findings

**Date:** 2026-10-11 · **Status:** approved by Chimezie on 2026-10-12. Phase 1 may start.

All three risk checks pass. No blockers for the README API. The two API additions (validator metadata, page naming) and the spec clarifications listed at the end are approved and applied to `README.md` and `docs/spec.md`. The headless library question is closed in `docs/decisions.md`.

| Check | Verdict | Recommendation |
| --- | --- | --- |
| 1. Type inference | Works. All 20 mistake cases fail `tsc` with no user generics, and the README resource compiles unchanged. | Keep the README API as written. |
| 2. VineJS introspection | Works. VineJS 4 exposes two public methods that cover required, lengths, min/max, step, pattern, choices, and array sizes. | Combine `toJSONSchema()` and `toJSON()` in one adapter. Explicit field hints are the fallback, and server validation stays the authority. |
| 3. Package pages | Works in the monorepo and in a tarball install. Public pages carry zero admin code. | Use package pages, an app-owned admin entry, app overrides first, and a per-request admin root view. |

## Setup

Versions installed and checked against `node_modules`, not from memory:

| Package | Version |
| --- | --- |
| `@adonisjs/core` | 7.6.0 |
| `@adonisjs/lucid` | 22.4.2 |
| `@adonisjs/inertia` | 5.0.1 |
| `@inertiajs/react` | 3.9.1 |
| `react` | 19.3.0 |
| `@vinejs/vine` | 4.4.0 |
| `@adonisjs/bouncer` | 4.0.1 |
| `vite` | 8.3.4 |
| `typescript` | 6.0.3 |
| `tailwindcss` | 4.3.3 |
| pnpm | 11.25.0 |
| Node | 24.3.0 (24.21.0 re-checked 2026-10-12) |

What exists now:

- **Root:** a pnpm workspace with `packages/*` and `apps/*`. Root scripts build the packages first, then fan out (see Commands in `CLAUDE.md`).
- **`packages/core` (`@mezielabs/azu`):** follows the AdonisJS package starter kit (tsdown, `configure.ts`, `stubs/`, Japa). It has a provider that mounts the package's Edge views. Spike code lives in `spike/` and ships under `@mezielabs/azu/spike`, so the demo consumes it across a real package boundary.
- **`packages/react` (`@mezielabs/azu-react`):** compiled with `tsc` and the Tailwind CLI. It ships `build/` and `src/`, because `admin:publish` needs the TSX source.
- **`apps/demo`:** the official `inertia-react` starter kit plus Bouncer, with users (with `role`), categories, products, tags, `product_tag`, orders, and `order_items`. `node ace migration:fresh --seed` gives 5 users, 4 categories, 5 tags, 40 products, and 20 orders. There's an `accessAdmin` ability, `ProductPolicy`, and create/update product validators. The spike runs on SQLite; Postgres and MySQL connections are Phase 1 CI work.

### Removing the spike code

The proofs are throwaway. **Phase 1 removes them using the tables below, not by searching for the `SPIKE (Phase 0)` header.** Most files don't carry the header, including all of `packages/react/src/`, `packages/core/resources/views/admin.edge`, and `apps/demo/inertia/admin/app.tsx`. Rebuild the real versions from these notes rather than promoting spike files.

Delete:

| Check | Files |
| --- | --- |
| 1 | `packages/core/spike/type_inference.ts`, `apps/demo/spike/type_inference_check.ts` |
| 2 | `packages/core/spike/vine_introspection.ts`, `packages/core/tests/vine_introspection.spec.ts`, `apps/demo/tests/unit/spike/vine_introspection.spec.ts` |
| 3 | `packages/core/spike/admin_inertia.ts`, `packages/core/resources/views/admin.edge`, `apps/demo/spike/admin_routes.ts` |
| 3 | All of `packages/react/src/`: `app.tsx`, `index.ts`, `styles.css`, `components/admin_layout.tsx`, `components/registry.tsx`, `pages/index.ts`, `pages/dashboard.tsx`, `pages/resource/index.tsx`. `FieldProps` moves to `@mezielabs/azu` (CLAUDE.md non-negotiable 10). |
| 3 | `apps/demo/inertia/admin/app.tsx` (the installer writes the real one), `apps/demo/inertia/admin/components/sku_badge.tsx`, `apps/demo/inertia/admin/pages/dashboard.tsx` |
| All | `packages/core/spike/index.ts`, then the empty `packages/core/spike/` and `apps/demo/spike/` folders |

Edit:

| File | Change |
| --- | --- |
| `packages/core/package.json` | Remove the `./spike` export and the `./spike/index.ts` tsdown entry |
| `apps/demo/start/routes.ts` | Remove the `SPIKE (Phase 0)` block that imports `../spike/admin_routes.js` |
| `apps/demo/vite.config.ts` | Replace the second entry point (`inertia/admin/app.tsx`) with the `azu()` Vite plugin (spec §11, week one) |
| `apps/demo/adonisrc.ts` | Keep the `@mezielabs/azu/azu_provider` line, but have `node ace add @mezielabs/azu` write it (FR-01) |

Keep as the real scaffold: the rest of `packages/core` (starter kit files, provider, configure hook) and the `packages/react` config files (`package.json`, `tsconfig*.json`, `eslint.config.js`, `LICENSE.md`).

---

## 1. Type inference

**Question:** can `defineResource(Model, …)` infer Lucid attribute and relation names well enough that misspelled names fail `tsc`, without users writing generics?

**Answer: yes.** `pnpm typecheck` checks the README's Product resource verbatim (only the import path changes), plus Order and User resources. It also checks 20 deliberate mistakes, each behind `@ts-expect-error`, so the build fails if a mistake ever compiles.

### How it works

1. Each builder captures its name as a string literal type: `column.text('name')` returns `Column<'text', 'name'>`.
2. `defineResource<Model, Policy>(model, options: ResourceOptions<NoInfer<Model>, Policy>)` infers `Model` from the first argument only. `NoInfer` matters here; without it TypeScript tries to infer the model from the columns.
3. `ResourceOptions` checks each array against a union computed from the model. For example, `ColumnFor<Model>` is "text columns over string attributes, or number columns over number attributes, or belongsTo columns whose title exists on the related model…".
4. Model shape comes from Lucid's own types. `ModelAttributes` covers data properties. The `$columns` tuple on AdonisJS 7's generated schema classes covers persisted columns. Relation properties are read through their `__opaque_type` brand, and the related model through `.model`.

### What works

- **Misspelled names fail:** columns, fields, filters, `title`, `search`, relation names, and `query: (q) => q.preload('categroy')` (that last one is Lucid's own typing).
- **Wrong types fail:** `column.text('price')` (price is a number), `filter.dateRange('name')`, and a relation passed to a scalar field.
- **Relations are checked at both ends:** `column.belongsTo('category', 'sku')` fails because Category has no `sku`. `field.manyToMany('tags').searchable('title')` fails because Tag has no `title`. A `hasMany` passed to `belongsTo` also fails.
- **Getters vs columns:** getters such as `isLowStock` work as display columns. They are rejected for `.sortable()`, `search`, and form fields, because those need SQL or writes.
- **Policy abilities:** `.ability('archive')` fails when `ProductPolicy` has no `archive` method.
- **Typed bulk handlers:** in `.handle(async (products) => …)`, `products` is inferred as `Product[]` with no annotation. `handle` is generic and TypeScript infers its record type from the array type `defineResource` expects. `p.nmae` inside the handler fails.
- **Composed models:** works with `compose(UserSchema, withAuthFinder(hash))` models.
- **Cost is small:** check time goes from 0.60s to 1.11s with 54 resource definitions in the demo.

### What doesn't

- **No autocomplete inside a chain.** In `column.text('|').sortable()` and `.ability('|')`, the editor offers nothing; the mistake is caught at the array element instead. Un-chained calls (`column.text('|')`, `column.belongsTo('category', '|')`) do get suggestions, but they aren't narrowed by kind: `column.text` also suggests number columns. Top-level `title` and `search` suggest exactly the right names. I measured this with the TypeScript language service.
- **Error messages are wordy.** Example: ``Type '"nmae"' is not assignable to type 'StringColumn<NoInfer<typeof Product>>'``. A sortable getter reports `'true' is not assignable to 'false'`, which is accurate but unhelpful.
- **Hand-written models without `$columns`** still get name checks, but getters can't be told apart from columns. So `column.text('excerpt').sortable()` compiles and fails at runtime. Generated schema classes, the AdonisJS 7 default, don't have this gap.
- **Lucid's `ExtractModelRelations` leaks `string | undefined`,** because `LucidRow` has an index signature. The prototype maps keys itself instead.
- **Runtime note for Phase 1:** `record.serialize()` drops getters unless they use `@computed()`, so the spike list showed `—` for `isLowStock`. List rendering should read each column from the model instance, not from `serialize()`.

### Recommendation

Keep the README API. It meets the spec rule (typos fail `tsc`, no generics) and gets typed action handlers for free. During Phase 1, rename the internal types so errors read better, for example `ProductStringColumn`, or a branded "`isLowStock` is a getter and can't be sorted" message. If early testers miss autocomplete in chains, an options form (`column.text('name', { sortable: true })`) can be added later without breaking anything.

**Spec changes:** none to the API. Clarify §4 (see Proposed changes).

---

## 2. VineJS introspection

**Question:** can required, maxLength, and min/max be read from a compiled VineJS validator at runtime? If not, what's the fallback?

**Answer: yes.** VineJS 4 validators (`vine.create({...})`, which replaces v3's `vine.compile(vine.object(...))`) have two public methods:

| | `toJSONSchema()` (JSON Schema draft 7) | `toJSON()` (compiled nodes + refs) |
| --- | --- | --- |
| Status | Documented, cached | Public, documented "for caching or debugging"; node shape comes from `@vinejs/compiler` types |
| Required | `required` array | `isOptional`, `allowNull` |
| Lengths, min/max, pattern, enum, array sizes | ✅ | Rule options (`minLength` → `{ min: 2 }`) |
| Dates | ❌ `vine.date()` comes out as `{}`, or `{"type":"null"}` when nullable | ✅ `subtype: 'date'` |
| Decimal places (step) | ❌ | ✅ `decimal` → `{ range: [0, 2] }` |
| Booleans | Lists accepted inputs (`"1"`, `"on"`, …) | ✅ `subtype: 'boolean'` |
| Conditional rules (`requiredWhen`) | Omits the field from `required` | Flagged as an `implicit` rule |
| Lucid `exists` and `unique` | Absent | Present, unnamed, options `{ table, column }` |
| Accuracy | `positive()` becomes `minimum: 0`; with `.email().url()` only the last `format` survives | Exact |

The prototype `introspectValidator()` walks the compiled tree for structure and type, and takes constraints from JSON Schema at the same path. On the demo's `createProductValidator` it returns correct hints for every field: required, lengths, `min`/`max`, `step: 0.01` for price, `integer` and `step: 1` for stock, enum choices, nullable/optional, the date field, and `tags.*`. Nested objects and arrays of objects work (`variants.*.sku`). Validation error paths (`variants.1.sku`) line up with hint paths. Tests: `packages/core/tests` (plain VineJS) and `apps/demo/tests/unit/spike` (real validators, booted app).

### What doesn't

- **Conditional schemas.** `vine.union` and `vine.group` come out as nested `anyOf` with no per-field structure in the compiled tree. The prototype skips them; their shape depends on the data.
- **Conditional and custom rules.** `requiredWhen` and similar can't be shown as required ahead of time; the hint says `conditional: true`. Custom rules made with `vine.createRule` give no hints.
- **Update validators that need metadata.** The demo's update validator checks SKU uniqueness against `field.meta.productId`. Azu has to pass that metadata when it validates, and it can't guess the shape (`vine.withMetaData<{ productId: number }>()`). The spec doesn't cover this yet; see Proposed changes.
- **Introspection needs the booted app.** Validators using Lucid's `unique`/`exists` throw at import time until Lucid's provider has registered those rules. That's fine at request time; just don't introspect from a bare script.
- **`toJSON()` is an internal shape.** It's a public method, but rule names and option keys are VineJS implementation details.

### Recommendation

- **One adapter in core:** `introspectValidator()`, using JSON Schema for constraints and compiled nodes for type, optional/nullable, decimal places, and conditional flags. Use peer range `@vinejs/vine ^4`. A contract test suite in core should fail loudly when a VineJS upgrade changes either shape.
- **Fallback, in this order:**
  1. Explicit field hints such as `field.number('price').min(0)` (already in the README) override introspection. They affect UI hints only, never validation.
  2. If neither source gives a hint, the field renders without one.
  3. The server always validates through the named validator, and 422 errors render under the field. No `required()` on fields, as the README says.
- **Write only validator output.** VineJS output contains only schema keys. So Azu picks declared fields, validates, then writes the validator output, never the raw payload. That's two layers of mass-assignment protection.
- **`admin:doctor` can compare top-level validator keys with declared fields.** The prototype already lists them.

---

## 3. Shipping Inertia React pages from a package

**Question:** how does the app's Vite build pick up pages and components in `node_modules`, with a separate admin entry and override resolution (app copy first, package second)?

**Answer:** the app owns a small admin entry, and the package supplies everything else as plain ES modules. Verified in the workspace (linked package) and in a separate copy of the demo installed from `pnpm pack` tarballs (real `node_modules`, Vite pre-bundling). Both were checked in dev in the browser and with a production build.

### How it works

- **App entry (written by the installer):** `inertia/admin/app.tsx` is three lines. It imports `@mezielabs/azu-react/styles.css` and calls `createAzuApp({ pages: import.meta.glob('./pages/**/*.tsx'), components: import.meta.glob('./components/**/*.tsx', { eager: true }) })`. The globs run in the app, where Vite supports them.
- **Package pages** are a static map of plain dynamic imports (`'resource/index': () => import('./resource/index.js')`). There's no `import.meta.glob` inside `node_modules`, which Vite's dependency pre-bundling wouldn't handle. Each page becomes its own lazy chunk.
- **Override resolution:** the server renders `azu/resource/index`. The client strips `azu/`, looks for `inertia/admin/pages/resource/index.tsx`, and falls back to the package's page. Verified: the app's copy of the dashboard rendered instead of the package's.
- **Component swap:** `column.text('sku').component('SkuBadge')` resolved `inertia/admin/components/sku_badge.tsx` by file name in all 25 rows.
- **Root view:** Inertia's `rootView` is one setting for the whole app, so Azu doesn't touch the app's config or layout. An admin middleware replaces `ctx.inertia` on `/admin` routes with `new Inertia(ctx, { ...config, rootView: 'azu::admin' }, vite)`. `azu::admin` is an Edge view the provider mounts from the package, and it loads the admin entry with `@vite`.
- **Typed renders:** core adds `azu/*` pages to `@adonisjs/inertia`'s `InertiaPages` interface, so `ctx.inertia.render('azu/resource/index', props)` is type-checked in core and in the app.
- **Styles:** the package compiles its own Tailwind 4 CSS (6.9 kB, theme as CSS variables, dark mode through `prefers-color-scheme`). The app doesn't need Tailwind; the AdonisJS 7 React starter doesn't use it.
- **Published pages compile unchanged.** Package pages import shared pieces only from `@mezielabs/azu-react` (a package self-import), never by relative path. A page copied into the app typechecks and lints there as is. The app's ESLint config rejects `Link` from `@inertiajs/react`, so the package re-exports `Link` and `Head`.

### Evidence

- **Production manifest:** the public entry imports its own chunk plus a shared vendor chunk (React, Inertia). A search finds no Azu code in either. The Azu CSS is linked only from the admin entry. Package pages are lazy chunks of the admin entry.
- **Dev mode:** the public homepage loads only `inertia/app.tsx` and its CSS.
- **One React and one Inertia:** there's a single `react.js`, `react-dom.js`, and `@inertiajs_react.js` in both setups, with no `resolve.dedupe`. In the tarball install, Vite pre-bundled the package as `@mezielabs_azu-react.js`, and its lazy page imports still worked.
- **No errors:** the browser console was clean on admin and public pages.

### What doesn't, or needs care

- **Shared props:** replacing `ctx.inertia` drops the app's shared props (`user`, `flash`, …) on admin pages. That's mostly what we want, but Azu must share its own: user, flash, abilities, branding. It also depends on the `Inertia` constructor, which is exported but could change between adapter versions. Pin `@adonisjs/inertia ^5` and cover it with an integration test.
- **Unused chunks:** overridden package pages are still built as lazy chunks that never load. The cost is negligible.
- **App components and styling:** app components can only use Tailwind classes that exist in Azu's prebuilt CSS. An app with Tailwind can add `@source` for the package. Otherwise, components style themselves or use Azu's CSS variables. This needs documenting.
- **Installer (FR-01):** the assembler has an `addVitePlugin` codemod but none for adding entry points. My recommendation is to ship an `azu()` Vite plugin that adds the admin entry, with `resolve.dedupe` as a safety net, and add it with `addVitePlugin`. **Not verified in the spike.**
- **No SSR** for admin pages. That's out of scope, and the starter ships with SSR off.
- **Dev environment, not Azu:** `node ace serve --hmr` crashed on Node 24.3.0 in a ts-exec loader hook, even with every Azu change removed. Confirmed fixed on Node 24.21.0 (2026-10-12): the server boots, serves `/admin`, and survives a backend hot reload. `pnpm dev` uses `--hmr` again, and `.nvmrc` pins Node 24.

### Recommendation

Build Phase 1 on this design: app-owned admin entry, package pages as a static dynamic-import map, `azu/<page>` names, app overrides first, Edge root view mounted from core, and a precompiled stylesheet. For `admin:publish`, copy from `@mezielabs/azu-react/src/pages/*` into `inertia/admin/pages/*` and stamp a version comment for `admin:doctor`. AdonisJS 7's `node ace eject` copies package stubs in a similar way and is worth reading first.

---

## Other findings

- **Node version mismatch.** The README says "Node.js 22 or later". The spec, `CLAUDE.md`, and the AdonisJS 7 starter (`engines: >=24`) say 24. The README should say 24 or later.
- **Lucid 22 generates schema classes.** Migrations write `database/schema.ts` (`ProductSchema` and so on), and models extend them. `make:admin-resource` (FR-04) can read `$columns` and decorator metadata instead of guessing. `database/schema_rules.ts` can narrow enum columns to unions. The demo does this for `status` and `role`, which gives the generator its `select` options.
- **Decimal columns.** The generated schema types them as `number`, but the Postgres driver returns decimals as strings. This isn't verified, because the spike ran on SQLite. Check it in Phase 1 Postgres CI before building number fields and currency formatting.
- **Codegen before tsc.** AdonisJS 7 needs `node ace codegen` before `tsc` (generated policy and page indexes). The demo's `typecheck` script now runs it.
- **The monorepo works.** AdonisJS package tooling (tsdown, ts-exec, Japa) runs fine in pnpm workspaces. The demo consumes the packages' built output, so root scripts build first. That settles the 2026-10-11 "revisit in the spike" note.

### Headless component library (open question in spec §12)

**Decided 2026-10-12:** React Aria Components (including its table) and Tiptap 3, pending the Phase 1 week-one UI check. No TanStack Table or Query in v1. See `docs/decisions.md`. The original recommendation follows.

Not prototyped in this spike. I recommend **React Aria Components** (1.22.1) over Radix (1.2.x) and Base UI (1.9.0):

- Its async combobox fits `belongsTo` search (FR-08).
- Its date and time pickers support time zones, for "in the app's timezone" (§5).
- It has keyboard-navigable tables and built-in i18n, which match the WCAG AA and i18n requirements.

It's heavier, but it loads only on `/admin`. **Tiptap 3** (3.31.4) for rich text, as the spec proposes. Both are runtime dependencies of `@mezielabs/azu-react`, so they need your approval. I'd validate them with a combobox, a date picker and an editor in the first days of Phase 1.

---

## Changes (approved and applied 2026-10-12)

All six were approved and applied to `README.md` and `docs/spec.md` in one commit. Where the final version differs from the proposal, the outcome is noted under the item.

1. **Validator metadata (README "Validation", spec §4 and §6).** Add an optional resource hook:

   ```ts
   validators: {
     create: createProductValidator,
     update: updateProductValidator,
     meta: ({ record, ctx }) => ({ productId: record?.id }),
   }
   ```

   Without this, update validators that exclude the current record from `unique` can't work. The default could pass `{ record, id }` for validators that don't declare metadata.

   **Outcome:** the default is `{ record }`: the record being edited on update, `undefined` on create.
2. **Page names (spec §8, README "Customising").** Spec §8 lists `Admin/Dashboard` and `Admin/Resource/Index`. AdonisJS 7 uses snake_case page paths (`auth/login`), so I propose `azu/dashboard` and `azu/resource/index` on the wire. Published copies would live at `inertia/admin/pages/resource/index.tsx`. `node ace admin:publish Resource/Index` can keep working by accepting both spellings, or the README example becomes `admin:publish resource/index`. Your call.

   **Outcome:** snake_case. The README example is now `admin:publish resource/index`, and `Resource/Index` is still accepted.
3. **Spec §4 clarifications (no API change):**
   - Sortable columns, `search`, and form fields must be persisted columns; getters are display-only.
   - Full getter/column separation needs generated schema classes (`$columns`).
   - Bulk action handlers receive typed records.
4. **Spec §4 introspection wording (no API change):**
   - Hints also include step, pattern, choices, and array sizes.
   - Conditional rules show as optional, and union/group schemas give no hints.
   - Explicit field hints override introspection for UI only.
5. **Spec §8 styling (no API change):** "Tailwind" means Azu's own prebuilt stylesheet; the app doesn't need Tailwind.
6. **README requirements:** Node.js 24 or later.
