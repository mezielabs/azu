# Release checklist: 0.1.0-preview

The first preview of `@mezielabs/azu` and `@mezielabs/azu-react`, for early testers. This is the checklist, with what's already true today (2026-10-16) and what's left.

**Nothing here has been published.** Publishing, the `mezielabs` npm org and its trusted-publisher settings are Chimezie's to approve and do. The items marked **(Chimezie)** need him; the rest can be done in a PR.

Status: ✅ done and checked · ⬜ to do · **(Chimezie)** needs his approval or access

## Language scope

The preview ships an English built-in UI. There is no panel-wide locale or translation catalog, and the built-in strings do not pass through AdonisJS i18n. Supplied labels and validation messages can use the app's wording. Release notes must not claim full localization or translation-ready UI; that integration remains deferred.

## 1. Version and tag

- ⬜ **Version** both packages `0.1.0-preview.0`, in one commit. They release together: `@mezielabs/azu-react` has a peer dependency on `@mezielabs/azu`, written `workspace:^`, which `pnpm publish` rewrites to `^0.1.0-preview.0`.
- ⬜ **npm dist-tag `preview`.** Publish with `--tag preview`. Without it, npm points `latest` at the prerelease, and `npm install @mezielabs/azu` would install a preview for everyone.
- ⬜ **Git tag** `v0.1.0-preview.0` on the release commit, and a GitHub release (marked pre-release) with the changelog entry.
- ⬜ **Later previews** bump the last number (`0.1.0-preview.1`). `0.1.0` itself is the Phase 3 release.

## 2. package.json fields

| Field | `@mezielabs/azu` | `@mezielabs/azu-react` | Needed |
| --- | --- | --- | --- |
| `name` | ✅ | ✅ | |
| `version` | ⬜ `0.0.0` | ⬜ `0.0.0` | `0.1.0-preview.0` |
| `description` | ✅ | ✅ | |
| `license` | ✅ MIT, `LICENSE.md` shipped | ✅ MIT, `LICENSE.md` shipped | |
| `author` | ✅ Mezie Labs | ✅ Mezie Labs | |
| `repository` | ⬜ missing | ⬜ missing | **Required for provenance**: npm checks it against the repo that built the package. `{ "type": "git", "url": "git+https://github.com/mezielabs/azu.git", "directory": "packages/core" }` (and `packages/react`) |
| `homepage` | ⬜ missing | ⬜ missing | `https://github.com/mezielabs/azu#readme` |
| `bugs` | ⬜ missing | ⬜ missing | `https://github.com/mezielabs/azu/issues` |
| `keywords` | ⬜ missing | ⬜ missing | e.g. `adonisjs`, `adonis`, `admin`, `admin-panel`, `inertia`, `react`, `lucid` |
| `engines` | ✅ `node >=24.21.0` | ✅ `node >=24.21.0` | |
| `type` | ✅ `module` | ✅ `module` | |
| `publishConfig` | ✅ `access: public`, `provenance: true` | ✅ same | |
| `peerDependencies` | ✅ AdonisJS 7 ranges; Drive and Vite optional | ✅ React 19, Inertia 3; Tiptap and `lucide-react` optional | |
| `sideEffects` | not set (server package) | ✅ `["*.css"]` | |
| README | ⬜ none in the package | ⬜ none in the package | npm shows a package's own README. A short one per package that links to the repo README, so the two can't drift. Images need absolute URLs (`https://raw.githubusercontent.com/mezielabs/azu/main/docs/screenshots/list-light.png`): npmjs.com doesn't resolve relative paths like the repo README's `./docs/screenshots/…`, and its sanitiser may not keep `<picture>` sources (unverified), so a plain `<img>` with the light capture is the safe choice. Check the rendered page after publishing |

## 3. Files and exports

- ✅ **Tarballs** from `pnpm pack` (`0.0.0`, today):
  - `@mezielabs/azu`: 135 files, 103 kB. `build/` with the provider, commands and their `commands.json` index, the stubs, services, `shared`, `vite` and `types`, plus `LICENSE.md`.
  - `@mezielabs/azu-react`: 124 files, 66 kB. `build/` with `azu.css`, and `src/`, which `azu:publish` copies pages from (`docs/decisions.md`, FR-15), plus `LICENSE.md`.
  - No tests, coverage, source maps or `tsbuildinfo` in either.
- ✅ **Exports** (each with `types` and `default`):
  - core: `.`, `./azu_provider`, `./services/main`, `./shared`, `./vite`, `./types`, `./commands`, `./package.json`
  - react: `.`, `./styles.css`, `./rich-text`, `./rich-text-fallback`, `./icons`, `./package.json`
- ✅ **`publint --strict`** (0.3.12): "All good" for both.
- ⬜ **`@arethetypeswrong/cli`** (0.18.2) crashed on both tarballs ("Cannot read properties of undefined (reading 'filename')") before checking anything. Try a newer release before publishing. Meanwhile, the quickstart's fresh app typechecked against the packed types (`docs/quickstart.md`).
- ✅ **Installed from the tarballs into a fresh app** (`docs/quickstart.md`): configure, `azu:resource`, the dev server and the panel all worked.
- ⬜ **Re-check after versioning:** `pnpm pack` again and confirm `@mezielabs/azu-react`'s peer on `@mezielabs/azu` reads `^0.1.0-preview.0`, not `workspace:^`.

## 4. Provenance and the publish workflow

`provenance: true` means npm must be able to verify where each tarball was built, which only works from a supported CI (GitHub Actions here). A `pnpm publish` from a laptop fails with this setting, which is the point.

- ⬜ **Workflow** `.github/workflows/release.yml`, run by hand (`workflow_dispatch`) or on a `v*` tag:
  - `permissions: { contents: read, id-token: write }`, the OIDC token npm uses for provenance and trusted publishing
  - Node 24.21 and pnpm 11, `pnpm install --frozen-lockfile`
  - the same checks as `ci.yml` (lint, typecheck, tests on SQLite, Postgres and MySQL, `pnpm budget`)
  - `pnpm -r publish --tag preview --access public --no-git-checks`, core first: pnpm publishes in dependency order, and it is what rewrites `workspace:^`. Plain `npm publish` wouldn't rewrite it.
- ⬜ **(Chimezie)** **The `mezielabs` org on npm** exists, and the two package names are free or already in it.
- ⬜ **(Chimezie)** **Trusted publishing** set up on npmjs.com for both packages, pointing at `mezielabs/azu` and `release.yml`, so the workflow needs no long-lived `NPM_TOKEN`. If a package must exist before it can be configured, the first publish uses a short-lived granular token instead, removed afterwards.
- ⬜ **(Chimezie)** Approve and run the workflow.
- ⬜ **After publishing:** both packages show a provenance badge on npmjs.com linking to the workflow run, and `npm view @mezielabs/azu dist-tags` shows `preview: 0.1.0-preview.0` with `latest` unset.

## 5. Changelog

- ⬜ **`CHANGELOG.md`** at the repo root, one file for both packages since they version together, in the Keep a Changelog style. Draft for this release:

  ```md
  ## 0.1.0-preview.0 (YYYY-MM-DD)

  First preview. The API will change based on feedback.

  - Install with `node ace add @mezielabs/azu`: provider, `config/azu.ts` and `start/azu.ts`, routes at `/admin`, a separate admin Vite entry, and an `accessAdmin` Bouncer ability that denies everyone until you change it (FR-01, FR-02)
  - Resources from your Lucid models, typed so misspelled names fail `tsc` (FR-03), generated by `azu:resource` with validators and an optional policy (FR-04)
  - List with server-side paging, sort, search and filters in the URL (FR-05, FR-13); create, edit and detail pages (FR-06)
  - Field types including rich text, files and images through Drive (FR-07), `belongsTo`, `hasMany` (FR-08) and `manyToMany` (FR-09)
  - Your VineJS validators and Bouncer policies, checked on the server for every route, field and action (FR-10, FR-11)
  - Row and bulk actions with confirmation, dialog fields and a built-in Delete (FR-12), and bulk actions on all matching rows in chunks (FR-17)
  - Brand colour, logo and name, with light and dark mode (FR-14); navigation groups, icons and order (FR-16)
  - Component swaps, slots, `azu:publish` and `azu:doctor` (FR-15)
  ```

- ⬜ **README:** update the pre-release note at the top to say the preview is on npm, with `--tag preview` in the install command until `0.1.0`.

## 6. Checks before publishing

- ⬜ CI green on the release commit (`ci.yml`: lint, typecheck, SQLite, Postgres 18, MySQL 8.4).
- ⬜ `pnpm budget`: within budget (initial admin JS was 111.6 kB of 120 on #24).
- ⬜ `pnpm bench:list` on Postgres with 100,000 products, against the 200 ms p95 target (spec §2 asks for it before each release).
- ⬜ `pnpm bench:widgets` on Postgres with 100,000 orders (`node ace bench:orders --count=100000`), against the 100 ms p95 per widget target (spec §2).
- ⬜ `pnpm prove:generator`: passes for every demo model.
- ⬜ `node ace azu:doctor` in the demo: 0 errors, 0 warnings.
- ⬜ The quickstart again, with the tarballs from the release commit (`docs/quickstart.md`).

## 7. After publishing

- ⬜ The quickstart from npm, on a fresh starter kit, then time it again and update `docs/quickstart.md`. Check whether `node ace add` takes a dist-tag (`@mezielabs/azu@preview`); if it doesn't, the README's install step for the preview is `npm i @mezielabs/azu@preview @mezielabs/azu-react@preview`, then `node ace configure @mezielabs/azu`.
- ⬜ Announce to the early testers in the repo's Discussions, with the changelog entry and the quickstart.
