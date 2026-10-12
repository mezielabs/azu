# Phase 1 week-one UI check

**Date:** 2026-10-12 · **Status:** approved by Chimezie on 2026-10-12 · **Code:** throwaway, on the `spike/ui-check` branch only (PR #4, closed unmerged)

Spec §11 asks for a week-one check of the riskiest UI before more UI is built on React Aria Components and Tiptap. The approval of both as runtime dependencies is conditional on this check (`docs/decisions.md`, 2026-10-12).

**Verdict: both pass.** Keep React Aria Components and Tiptap 3. Nothing here blocks them. The check did turn up six things Phase 1 has to build in (see "What Phase 1 has to build in"), and one change to the approved table scope: resizable columns.

| Check | Result |
| --- | --- |
| Async `belongsTo` combobox | ✅ Requests abort, the last response wins, and it's fully keyboard operable. Needs a small wrapper (input sync, explicit Clear). |
| Timezone-aware date picker | ✅ Shows and edits in the app's timezone, including the DST transition, and the server round trip is exact. |
| List table: keyboard selection and a bulk action | ✅ Selection, select-all, server-side sort via partial reload, confirm dialog. ⚠️ Column resizers block keyboard sorting as composed. |
| Lazily loaded Tiptap | ✅ Loads only when used (120 kB gz). ⚠️ A plain lazy import broke builds without Tiptap; fixed via `azu()`. |
| Accessibility (axe-core 4.14, WCAG 2.1 A/AA) | 1 violation: Tiptap's editor has no accessible name. React Aria components clean. |
| Bundle | Public pages untouched. Admin initial JS 106 kB gz; React Aria pages about +141 kB gz, lazy. |

## How it was tested

- **Page:** `/admin/ui-check` in the demo, rendered through Azu's real admin pipeline from FR-01: the `azu::admin` root view, the `azu()` plugin and `createAzuApp`. Throwaway server routes in `apps/demo/spike/ui_check_routes.ts`.
- **Timezone:** the page treats `Europe/London` as the app's timezone, because it leaves British Summer Time on 2026-10-25 at 01:00 UTC. That gives the date picker a real DST transition.
- **Network:** the category search adds an artificial 400 ms delay, so in-flight requests can be aborted.
- **Interaction:** every interaction was driven with real keyboard input in the in-app browser (Chromium, `en-GB` locale), with state read back from the DOM.
- **Without Tiptap:** I repeated the lazy-Tiptap and bundle checks in the fresh AdonisJS 7 app from FR-01, installed from `pnpm pack` tarballs, both without and with `@tiptap/*`.

Versions: `react-aria-components` 1.22.1, `@internationalized/date` 3.12.4, Tiptap 3.31.4, axe-core 4.14.0.

## 1. Async `belongsTo` combobox

React Aria's `ComboBox` fed by `useAsyncList` (re-exported by `react-aria-components`), using plain `fetch`. `useAsyncList` passes an `AbortSignal` to the loader and aborts the previous request whenever the filter text changes, so this satisfies the "fetch with AbortController" decision with no extra code.

**Works:**
- **Aborts:** clearing the field and typing b, o, o fired 4 requests. 3 were aborted mid-flight, and only "Books" (the last response) rendered. No stale or out-of-order results.
- **Keyboard:** type, ArrowDown, then Enter selects. The popover closes and `aria-expanded`/`aria-activedescendant` are correct.
- **Blur:** after editing the text, leaving the field restores the selected item's label. This is the right behaviour for a field that doesn't accept free text.

**Needs building:**
- **Sync the input with the selection.** The input value has to be controlled by the async list's `filterText`, and React Aria then doesn't write the selected item's label back: after picking Kitchen, the input still showed "kit". The fix is three lines in `onSelectionChange` (verified). It belongs inside Azu's combobox, not in every field.
- **An explicit Clear button for nullable relations.** Deleting all the text and tabbing away restores the previous selection, so a user can't remove a `belongsTo` value. Optional relations need a Clear control.
- **Edit forms must seed the current value.** The server sends the selected id *and* its title, so the combobox can show the label without a search. Not exercised here; the edit page needs it.
- **TypeScript:** the item type isn't inferred inside `ListBox`'s render function; it needs an annotation (`(item: Category) => …`). This is internal to Azu, so it's only a minor annoyance.

## 2. Timezone-aware date picker

React Aria's `DatePicker` holds a `ZonedDateTime` from `@internationalized/date`. The server sends a UTC instant, `parseAbsolute(iso, appTimezone)` turns it into the app's zone, and submit sends `value.toAbsoluteString()` (UTC) back.

**Works:**
- **Display:** 2026-09-02T09:15Z shows as `02/09/2026, 10:15 BST`.
- **DST:** starting at 01:30 BST on 2026-10-25 and pressing ArrowUp on the hour gives **01:30 GMT**, the repeated hour (UTC 00:30Z → 01:30Z, label BST → GMT), then 02:30 GMT. ArrowDown steps back through 01:30 GMT. No invalid times.
- **Server round trip:** exact. The server received 01:30Z for the ambiguous hour and 09:15Z for the regular date. Luxon in the right zone gives the same wall-clock times.
- **Calendar popover by keyboard:** focus starts on the selected day, arrows move, and Enter picks and closes. Focus returns to the trigger, and the time and zone are kept.

**Needs building:**
- **Locale.** React Aria formats dates in the browser's locale (dd/mm/yyyy here, from `en-GB`). Azu should wrap the admin in `I18nProvider` with the locale from AdonisJS i18n (spec §2: all UI strings go through i18n).
- **Zone names.** Luxon on Node calls BST "GMT+1"; React Aria shows "BST". Any server-rendered times should format through the same `Intl` path as the picker.
- **Date-only fields** (`field.date`) use `CalendarDate`, which has no zone. Not exercised, but there's no zone risk there.

## 3. List table: keyboard row selection and a bulk action

React Aria's `Table` with `selectionMode="multiple"`. Sorting is on the server through an Inertia partial reload (`only: ['products', 'sort']`), with `ResizableTableContainer`/`ColumnResizer` for resizing and a `DialogTrigger` + `Modal` confirm for the bulk action.

**Works:**
- **Keyboard selection:**
  - Clicking a row selects it.
  - ArrowUp/Down move focus, Space toggles, and Shift+Arrow extends the range.
  - Cmd+A selects all: React Aria reports the sentinel `'all'`, and the header checkbox ticks.
  - Escape clears.
- **Server sort by keyboard** (without resizers): ArrowUp from the first row reaches the header row, arrows move between headers, and Enter sorts. The URL updated to `?sort=status&direction=ascending` with no full reload, and focus stayed on the header.
- **Bulk action end to end by keyboard:**
  - Selected the 10 drafts with Space then Shift+ArrowDown, and Shift+Tab reached "Publish selected".
  - Enter opened an `alertdialog` reading "Publish 10 products?", with focus on Publish and the rest of the page inert.
  - Enter published them, showed "10 products published" (`role=status`), and cleared the selection, keeping the sort and URL.

**Problems:**
- **Column resizers block keyboard sorting.** With a `ColumnResizer` inside each header, keyboard focus in the header row lands on the resize handles (`<input aria-label="Resizer">`). Arrows move between handles and Enter does nothing, so **a keyboard user can't sort a resizable column**. With resizers off, sorting works (above). React Aria's documented pattern for columns that both sort and resize is a menu in each header (Sort ascending, Sort descending, Resize). **Recommendation:** ship v1 with sorting and selection and no resizing. Add resizing later through the header-menu pattern, after its own keyboard check. Resizing isn't in `README.md` or the spec's FRs; it was only in the 2026-10-12 decision, which this would amend.
- **Focus is lost after a bulk action.** The confirm dialog closes after its action clears the selection, which disables the trigger button, so React Aria can't return focus and it falls to `<body>`. Azu should move focus to the table, or to the result message, when the action finishes.
- **Selection survives a server re-sort.** `ids: 11` stayed selected after sorting moved that row. Selection should be cleared or pruned whenever the rows prop changes (sort, filter, page).

**Notes:**
- **`'all'` maps to FR-17.** React Aria's select-all is a sentinel, not a list of ids. "Select all N matching" can treat `'all'` as "every row on this page" and offer the all-matching upgrade.
- **Checkbox indicator.** React Aria's selection `Checkbox` renders nothing visible on its own; Azu supplies the indicator.
- **Cost of non-negotiable 9.** Stateful parts (rows, options, cells, date segments) need a `className` render function to map React Aria state onto `azu-is-selected` / `azu-is-focused`. That's verbose, but contained in Azu's components, and it keeps the stylesheet free of React Aria's data attributes. `Cell` passes `data-azu-*` attributes through.
- **No toast component.** React Aria's Toast is still `UNSTABLE_` in 1.22, so for the success toasts in FR-06 and FR-12, Azu should ship its own small toast region (an `aria-live` region) rather than depend on an unstable API.

## 4. Lazily loaded Tiptap

The editor is a separate subpath, `@mezielabs/azu-react/rich-text-editor`, loaded with `React.lazy`. Tiptap is an optional peer.

**Works:**
- **Tiptap loads only when used,** in dev and in production. Before the field rendered, only a small wrapper module loaded. Showing it fetched the editor plus `@tiptap/react` and `@tiptap/starter-kit`. Production chunk: **119.9 kB gz**.
- **Keyboard editing:** typing continues formatting correctly, Cmd+B toggles bold, and `onChange` emits HTML (`<p>Hello <strong>Azu and </strong>plain</p>`). Toolbar buttons expose `aria-pressed`.
- **Apps without Tiptap build after the fix** (below), in dev and production, and get a plain textarea with an install hint.
- **Apps with Tiptap installed:** `azu()` detects it and bundles the real editor instead of the fallback.

**The risk was real: a plain lazy import breaks apps that don't install Tiptap.** In the fresh app without `@tiptap/*`, `vite build` failed with ``Rolldown failed to resolve import "@tiptap/react"``. Rolldown resolves every dynamic import at build time, so laziness doesn't help. Any app would have failed to build just by installing Azu.

**The fix, verified in the fresh app, dev and production, with and without Tiptap:**
- The front-end package declares its optional features in an `azu` field in its own `package.json`: the lazy subpath, a fallback subpath, the peers it requires, and what to pre-bundle.
- `azu()` reads that field. When a feature's peers are missing, it aliases the feature to its fallback.
- Vite's dev optimizer honours the alias too: it produced a `missing-*.js` chunk with no errors.
- Core stays free of React and Tiptap knowledge (non-negotiables 8 and 12).

**Dev reload, fixed the same way.** In the demo, the first time the lazy editor loaded, Vite discovered `@tiptap/*` late, re-optimized and **reloaded the page**, which would lose unsaved form input. The same late discovery happened for React Aria on the first admin load. `azu()` now adds the package's dependencies and any installed feature peers to `optimizeDeps.include`.

**Needs building:**
- **An accessible name for the editor.** The editable area has `role=textbox` and no label. axe flags it as serious (`aria-input-field-name`). Pass `aria-labelledby` (the field label) through Tiptap's `editorProps.attributes`.
- **Server-side sanitising** (spec §5: "output sanitised") is still FR-07 work; the editor's own output isn't a security boundary.

## 5. Accessibility scan

axe-core 4.14.0 with the WCAG 2.0/2.1 A and AA tags, run on the whole check page with the editor showing and popovers closed:

- **29 passing checks.**
- **1 violation:** the Tiptap editor's missing accessible name (above).
- **Incomplete (manual review):**
  - one `color-contrast`
  - three `label-content-name-mismatch` on icon buttons whose visible emoji (▾, 📅) differs from their `aria-label`. Real icons with `aria-hidden` fix this.
- **Not scanned:** open popovers, the open dialog, and dark mode. Those belong in the CI axe checks (spec §10).

## 6. Bundle

Production build of the demo, sizes gzipped:

| Chunk | Size | Loaded |
| --- | --- | --- |
| Public entry (`inertia/app.tsx`) | 114.7 kB JS, 3.4 kB CSS | Public pages. No React Aria, Tiptap or Azu code (checked) |
| Admin entry: React, ReactDOM, Inertia, Azu shell | 106.0 kB JS, 3.2 kB CSS | Every admin page |
| Check page: React Aria `ComboBox`, `DatePicker`, `Calendar`, `Table`, `Dialog`/`Modal`, plus `@internationalized/date` | +140.8 kB | Lazily, with the page |
| Tiptap editor | +119.9 kB | Only when a rich text field renders |

- **React Aria cost.** Real list and form pages will carry roughly the check page's ~141 kB gz. That's acceptable for an admin, but there's no budget in spec §2. Suggest one: admin initial JS ≤ 120 kB gz, and each page's lazy chunk ≤ 160 kB gz.
- **Chunking quirk.** Rolldown placed some code shared by the editor and the check page in the check page's chunk, so the editor statically imports it. When real pages land, group React Aria into its own chunk (Rolldown `codeSplitting` groups), so lazy features don't pull in unrelated page code.

## What Phase 1 has to build in

These come from the problems and "needs building" items above:

1. **Combobox wrapper:** input/selection sync, an explicit Clear for nullable relations, and seeding the current value on edit.
2. **`I18nProvider`** with the locale from AdonisJS i18n.
3. **Table:** no column resizing in v1. Move focus after bulk actions, and clear the selection when rows change.
4. **An accessible label on the rich text editor.**
5. **Azu's own toast region,** rather than React Aria's unstable Toast.
6. **Promote the `azu()` changes from this spike** (`azu.optionalFeatures` aliasing and `optimizeDeps.include`) into the real plugin, with tests, before `field.richText()` ships.

## Decisions (approved 2026-10-12)

All recorded in `docs/decisions.md`:

- **No column resizing in v1.** Add it later through React Aria's header-menu pattern, after a keyboard check.
- **React Aria Components and Tiptap 3 are confirmed** as runtime dependencies. They're added to `@mezielabs/azu-react` when the first component that uses them lands.
- **Optional features through `azu()`:** an `azu` field in the front-end package's `package.json`, fallback aliasing when peers are missing, and `optimizeDeps.include`. The field is internal and undocumented for now.
- **Azu ships its own toast region** instead of React Aria's `UNSTABLE_Toast`.
- **Admin bundle budget,** in spec §2 and checked in CI: ≤ 120 kB gz initial admin JS, and ≤ 160 kB gz per page's lazy chunk.

## Removing the spike code

**Done.** None of the check-page code reached `main`: it lived only on `spike/ui-check`, and PR #4 was closed unmerged. The replacement PR verified that none of the files below exist on `main`. The `azu()` optional-features code was promoted into the real plugin with tests, rather than deleted. The table is kept as the record:

| Where | Files |
| --- | --- |
| `packages/react` | `src/spike/` (all of `ui_check/`), and the `'spike/ui_check'` entry in `src/pages/index.ts` |
| `packages/react` | `src/rich_text/editor.tsx`, `src/rich_text/missing.tsx`, the `./rich-text-editor` and `./rich-text-missing` exports, and the `azu` field in `package.json`. Rebuild them for real with `field.richText()` (FR-07) |
| `packages/react` | The `SPIKE (Phase 1 UI check)` section at the end of `src/styles.css` |
| `packages/core` | The `frontEndFeatures` code and the `alias`/`optimizeDeps` lines in `src/vite/plugin.ts`, or keep them as the starting point for item 6 above, with tests |
| `apps/demo` | `spike/ui_check_routes.ts` and its `await import(...)` block at the end of `start/routes.ts` |
| Dependencies | `axe-core` in the demo's devDependencies (add it back with the CI axe checks). React Aria, `@internationalized/date` and the Tiptap peers are added when their first real component lands |
