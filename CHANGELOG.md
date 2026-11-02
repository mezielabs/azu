# Changelog

`@mezielabs/azu` and `@mezielabs/azu-react` version and release together. Dates are publication dates, not when the work was done.

## 0.1.0-preview.0 — Unreleased

The first preview, for early testers. Nothing is published yet. The API may change before 0.1.0; review IDs (C01, U05…) refer to [the 22 October 2026 review](docs/reviews/2026-10-22-azu-review.md).

### Added

**The panel (Phases 1 and 2, FR-01 to FR-17)**

- `node ace configure @mezielabs/azu`: config, the `azu()` Vite plugin with a separate admin entry, routes on `/admin`, and an `accessAdmin` Bouncer ability that denies everyone until you change it.
- Resources from your Lucid models, typed against them, so a misspelled column or field fails `tsc`. `node ace azu:resource` writes one, with its policy and validators. Lists page, sort, search and filter on the server and keep it all in the URL; forms and detail pages; `belongsTo`, `hasMany` and `manyToMany` relationships, preloaded.
- Your VineJS validators and Bouncer policies are the only rules: every route, field and action is checked on the server, each record of a bulk action included, and a missing policy method means denied. Only declared fields are read from a request.
- Field types from text to rich text (Tiptap, lazy, sanitised on the server) and Drive uploads; row and bulk actions, with dialog fields and a run on every filtered row; filters; light and dark theming; navigation groups, icons and order; component overrides, slots, `azu:publish` and `azu:doctor`.

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

**From the review**

- **Form sections (U08, #56).** `.section('Details')` groups resource, screen and action form fields under headings: `h2` on a page, `h3` in an action dialog.
- **List column choices (U09, #57).** A Columns control beside the filters (beside Sort by on phones) shows or hides columns, `.hiddenByDefault()` ones included. The choice is in the URL as `?columns=name,price`, so it survives a reload, coming back from a record and a shared link. `columns` is now a reserved filter name.
- **`.compact()` on value, progress and partition widgets (U01, #49).** Figures from 1,000,000 up are abbreviated ("NGN 4.28M") by default; `.compact()` abbreviates every figure and `.compact(false)` none.
- **Phones (U05, #53).** Card lists offer Sort by and a Select records mode for bulk actions, including on every matching row.

### Fixed before release

From the 22 October 2026 review, and one found in Mezie Labs:

- **C01 (#46):** switching a widget screen's range quickly could leave figures from an earlier range on the page. Each switch now cancels in-flight loads, and only the latest switch's reloads start.
- **C02 (#47):** a partition's "Other" row and its percentages were wrong for averages, minima and maxima. They're computed from the omitted records again, and they have no percentage (`PartitionRow.percent` is `number | null`).
- **C03 (#48):** a `manyToMany` picker could miss a visible related record when one record had many pivot rows. The 200-record limit now counts distinct records.
- **U01 (#49):** large currency figures overflowed narrow widget cards. They're abbreviated, with the exact figure for screen readers and on hover, and a full figure wraps at the space after the currency code before it splits digits.
- **U02 (#50):** signing in from an admin bookmark landed on the app's dashboard. Azu remembers the admin page a guest asked for (never JSON requests or partial reloads), and the README shows the login code that returns there.
- **U03 (#51):** delete confirmations didn't say what would be deleted. They name the record, or the number of selected or matching records, and say that it's permanent.
- **U04 (#52):** a custom field component couldn't show the field as required. `FieldProps.field.required` gives it what the validator says.
- **U05 (#53):** phone lists had no sorting or bulk selection (see Added).
- **U06 (#54):** phone cards cut titles and details short. Titles get two lines, each detail its own line, and the badge sits below them.
- **U07 (#55):** form and dialog controls were small on phones and touch screens. They're at least 44px tall there.
- **U08 (#56):** after a rejected save, focus sometimes didn't reach the first invalid field; it now moves there once the errors have rendered.
- **R03 (#58):** the docs implied translations. The preview's own interface is English-only, and the README, spec and release guide say so.
- **R04, R05 (#61):** the README now says uploads need a public disk for now, and the roadmap and milestones match what's built.
- **SSR (#60):** an app with Inertia SSR on got a 500 on `/admin`. Azu's pages always render in the browser; the app's own pages keep their SSR.

### Release

- **R01 (#59):** both packages are `0.1.0-preview.0`, with repository, homepage and keywords, package READMEs, and a tarball check (`pnpm pack:check`) that the release workflow runs before publishing exactly those tarballs, with npm provenance, under the `preview` dist-tag.
- **R02 (#59):** the release workflow runs a smoke subset (login, a list, a form save, an action and the Overview) in Firefox and WebKit, besides the full suite in Chromium.

### Preview limits

- Azu's own interface is in English only; AdonisJS i18n integration comes later. Your labels and validation messages can use any wording.
- `file` and `image` fields need a public Drive disk: private disks and signed URLs aren't supported yet.
- Not yet built: soft deletes and global search (FR-18, FR-19), navigation badges.
