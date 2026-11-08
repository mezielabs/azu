# Changelog

`@mezielabs/azu` and `@mezielabs/azu-react` version and release together. Dates are publication dates, not when the work was done.

## 0.1.0-preview.1 — Unreleased

### Changed

- `node ace configure @mezielabs/azu`'s refusal and the `E_AZU_SETUP` error point to the [Starter kits](https://azuadmin.com/docs/starter-kits/) page at azuadmin.com instead of the README (#76).
- Both package READMEs link to the documentation at [azuadmin.com](https://azuadmin.com) and describe the two-step preview install (#76, #81, #83).
- `node ace azu:resource --help` describes what `--policy` and `--readonly` generate.

### Fixed

- A manyToMany field's detail and edit pages no longer fail when the related resource's query hook preloads a relation (#79).

### Documentation

- The documentation is now a site at [azuadmin.com](https://azuadmin.com), with the guides and reference that used to be the README, plus new pages on [adding an existing model](https://azuadmin.com/docs/guides/existing-model/), [builders](https://azuadmin.com/docs/reference/builders/), [resource hooks](https://azuadmin.com/docs/reference/resource-hooks/) and [upgrading](https://azuadmin.com/docs/guides/upgrading/) (#76–#83).

## 0.1.0-preview.0 — 2026-11-03

The first preview, for early testers. Install it with the `preview` tag (see the README). The API may change before 0.1.0.

### Added

**The panel (Phases 1 and 2, FR-01 to FR-17)**

- `node ace configure @mezielabs/azu`: config, the `azu()` Vite plugin with a separate admin entry, routes on `/admin`, and an `accessAdmin` Bouncer ability that denies everyone until you change it.
- Resources from your Lucid models, typed against them, so a misspelled column or field fails `tsc`. `node ace azu:resource` writes one, with its policy and validators. Lists page, sort, search and filter on the server and keep it all in the URL; forms and detail pages; `belongsTo`, `hasMany` and `manyToMany` relationships, preloaded.
- Your VineJS validators and Bouncer policies are the only rules: every route, field and action is checked on the server, each record of a bulk action included, and a missing policy method means denied. Only declared fields are read from a request.
- Field types from text to rich text (Tiptap, lazy, sanitised on the server) and Drive uploads; row and bulk actions, with dialog fields and a run on every filtered row; filters; light and dark theming; navigation groups, icons and order; component overrides, slots, `azu:publish` and `azu:doctor`.
- Azu's Ace commands live under `azu:` (`azu:resource`, `azu:action`, `azu:screen`, `azu:publish`, `azu:doctor`), with its config in `config/azu.ts` and preloads in `start/azu.ts` (#39).
- An account menu in the sidebar, with the user's name and email, View site, Sign out, and Light, Dark and System themes (#37).
- Forms: "Create & add another" and "Save & keep editing" beside the primary button (#40), and a "Leave without saving?" guard on any visit away from unsaved changes, with the browser's own prompt on close or reload (#38).
- Delete confirmations name the record, or the number of selected or matching records, and say it's permanent (#51).
- With session middleware, Azu remembers the admin page a guest asked for, so your login can return there; the README shows the login code (never JSON requests or partial reloads) (#50).
- Custom field components get `FieldProps.field.required` from the validator, to show a field as required as built-in fields do (#52).
- Admin pages always render in the browser, even when your app uses Inertia SSR for its own pages (#60).

**Screens (FR-20 to FR-22, #41)**

- `defineScreen()` in `app/admin/screens` adds your own page at `/admin/screens/<name>`, behind a required Bouncer ability that's checked on every request. `data(ctx)` runs on the server as a lazy prop. `node ace azu:screen <Name>` writes one that compiles and renders as it is.
- `navigation.links` adds links to any URL, grouped and ordered with resources and screens; external links open in a new tab.
- `home` shows a screen at `/admin`, or `{ resource }` redirects to its list for users who may list it.

**Screen forms (FR-23, #42)**

- `defineScreen({ form: { fields, validator, load, save } })` renders a form with the resource forms' layout and saves it through your validator; storage stays in your app. Field names are typed against `load`'s return. `node ace azu:screen <Name> --form` writes one and its validator.

**Widgets (FR-24, #44)**

- `widgets: [...]` on a screen, from `metric` builders: `value()` compared with the period before (`.lowerIsBetter()` for figures where down is good), `progress()` against a goal, `partition()` as bars per value, and `table()` with the resource's columns. `count`, `sum`, `avg`, `min` and `max`, exact on Postgres, MySQL and SQLite.
- Every widget's query starts from its resource's `query` hook, and a widget shows only to users who may list that resource; `using(fn)` widgets need an `.ability()`.
- Ranges from today to the year to date, in the panel's timezone, kept in `?range=`. Each widget loads on its own; one that fails shows "Couldn't load this" with Try again, and the rest of the page is unaffected.

**Trend widgets (FR-25, #45)**

- `metric.trend()` with a required `.date(column)`: a figure per hour, day, week or month in the panel's timezone (the bucket follows the range unless `.by()` sets it, up to 100), as a line or `.bars()`, with `.compare()` for the period before. One query per period, a hand-written SVG chart with keyboard navigation, a table view, and links to the list filtered to a bucket.

**Form sections, column choices and phones**

- **Form sections (#56).** `.section('Details')` groups resource, screen and action form fields under headings: `h2` on a page, `h3` in an action dialog.
- **List column choices (#57).** A Columns control beside the filters (beside Sort by on phones) shows or hides columns, `.hiddenByDefault()` ones included. The choice is in the URL as `?columns=name,price`, so it survives a reload, coming back from a record and a shared link. `columns` is now a reserved filter name.
- **`.compact()` on value, progress and partition widgets (#49).** Figures from 1,000,000 up are abbreviated ("NGN 4.28M") by default, with the exact figure for screen readers and on hover; `.compact()` abbreviates every figure and `.compact(false)` none.
- **Phones.** Card lists offer Sort by and a Select records mode for bulk actions, including on every matching row (#53). Cards give titles two lines and each detail its own line (#54). Form and dialog controls are at least 44px tall on phones and touch screens (#55).

### Reviewed

Everything above went through [the 22 October 2026 review](https://github.com/mezielabs/azu/blob/main/docs/reviews/2026-10-22-azu-review.md) before this release; its fixes (C01–C03, U01–U09, R01–R05) are part of the features they touch.

### Release

- Both packages are `0.1.0-preview.0`, with repository, homepage and keywords, package READMEs, and a tarball check (`pnpm pack:check`) that the release workflow runs before publishing exactly those tarballs, with npm provenance, under the `preview` dist-tag.
- The release workflow runs a smoke subset (login, a list, a form save, an action and the Overview) in Firefox and WebKit, besides the full suite in Chromium.

### Preview limits

- Azu's own interface is in English only; AdonisJS i18n integration comes later. Your labels and validation messages can use any wording.
- `file` and `image` fields need a public Drive disk: private disks and signed URLs aren't supported yet.
- Not yet built: soft deletes and global search (FR-18, FR-19), navigation badges.
