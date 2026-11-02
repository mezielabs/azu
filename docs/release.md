# Release checklist: 0.1.0-preview

The first preview of `@mezielabs/azu` and `@mezielabs/azu-react`, for early testers. **Verified on `61dde23`** (#59's merge into `main`), 2026-11-02: the figures below are from that commit, and replace earlier ones. Compatibility with each official starter kit is in [`docs/compatibility.md`](compatibility.md).

**Nothing here has been published.** Publishing, the `mezielabs` npm org and its trusted-publisher settings are Chimezie's to approve and do. The items marked **(Chimezie)** need him; the rest can be done in a PR.

Status: ✅ done and checked · ⬜ to do · **(Chimezie)** needs his approval or access

## Language scope

The preview ships an English built-in UI. There is no panel-wide locale or translation catalog, and the built-in strings do not pass through AdonisJS i18n. Supplied labels and validation messages can use the app's wording. Release notes must not claim full localization or translation-ready UI; that integration remains deferred.

## 1. Version and tag

- ✅ **Version** both packages `0.1.0-preview.0`, in one commit. They release together: `@mezielabs/azu-react` has a peer dependency on `@mezielabs/azu`, written `workspace:^`, which `pnpm pack` rewrites to `^0.1.0-preview.0`.
- ⬜ **npm dist-tag `preview`.** Publish with `--tag preview`. Without it, npm points `latest` at the prerelease, and `npm install @mezielabs/azu` would install a preview for everyone.
- ⬜ **Git tag** `v0.1.0-preview.0` on the release commit, and a GitHub release (marked pre-release) with the changelog entry.
- ⬜ **Later previews** bump the last number (`0.1.0-preview.1`). `0.1.0` itself is the Phase 3 release.

## 2. package.json fields

| Field | `@mezielabs/azu` | `@mezielabs/azu-react` | Needed |
| --- | --- | --- | --- |
| `name` | ✅ | ✅ | |
| `version` | ✅ `0.1.0-preview.0` | ✅ `0.1.0-preview.0` | Coordinated preview |
| `description` | ✅ | ✅ | |
| `license` | ✅ MIT, `LICENSE.md` shipped | ✅ MIT, `LICENSE.md` shipped | |
| `author` | ✅ Mezie Labs | ✅ Mezie Labs | |
| `repository` | ✅ | ✅ | **Required for provenance**: npm checks it against the repo that built the package. `{ "type": "git", "url": "git+https://github.com/mezielabs/azu.git", "directory": "packages/core" }` (and `packages/react`) |
| `homepage` | ✅ | ✅ | `https://github.com/mezielabs/azu#readme` |
| `bugs` | ✅ | ✅ | `https://github.com/mezielabs/azu/issues` |
| `keywords` | ✅ | ✅ | e.g. `adonisjs`, `adonis`, `admin`, `admin-panel`, `inertia`, `react`, `lucid` |
| `engines` | ✅ `node >=24.21.0` | ✅ `node >=24.21.0` | |
| `type` | ✅ `module` | ✅ `module` | |
| `publishConfig` | ✅ `access: public`, `provenance: true` | ✅ same | |
| `peerDependencies` | ✅ AdonisJS 7 ranges; Drive and Vite optional | ✅ React 19, Inertia 3; Tiptap and `lucide-react` optional | |
| `sideEffects` | not set (server package) | ✅ `["*.css"]` | |
| README | ✅ Package guide | ✅ Package guide | Short package-specific READMEs link to the repository guide, changelog and issue tracker. Verify rendering on npm after publication. |

## 3. Files and exports

`pnpm pack:check` builds both packages, packs them with pnpm, and inspects the actual tarballs with `scripts/check_release_packages.mjs`. It checks versions, metadata, exports, templates, page sources, README/license files, excluded development files and the rewritten React peer range. It writes `artifacts/packages/verification.json` with the source commit, dirty-tree flag, file counts, sizes and SHA-256 hashes. CI rejects a dirty source tree. React's build clears its output first to prevent stale files from an earlier checkout entering a release.

On `61dde23` (`pnpm pack:check` locally, and the release workflow's `packages` job in [run 41453957618](https://github.com/mezielabs/azu/actions/runs/41453957618), with identical sizes):

- ✅ **Tarballs:**
  - `@mezielabs/azu` `0.1.0-preview.0`: 194 files, 213,227 bytes, sha256 `23629f92cff209b4…`.
  - `@mezielabs/azu-react` `0.1.0-preview.0`: 173 files, 125,087 bytes, sha256 `58e20828219b4685…`.
  - Source tree clean; `verification.json` records the commit and full hashes.
- ✅ **Exports** (each with `types` and `default`):
  - core: `.`, `./azu_provider`, `./services/main`, `./shared`, `./vite`, `./types`, `./commands`, `./package.json`
  - react: `.`, `./styles.css`, `./rich-text`, `./rich-text-fallback`, `./icons`, `./package.json`
- ✅ **Peer rewritten:** `@mezielabs/azu-react`'s peer on `@mezielabs/azu` reads `^0.1.0-preview.0` in the tarball, not `workspace:^`.
- ✅ **`publint --strict`** (0.3.12): passed for both, in CI's "Strict package export lint" step on this commit.
- ✅ **Tarball tests** (`scripts/tests/release_packages.spec.mjs`): 4 of 4.
- ⬜ **`@arethetypeswrong/cli`:** not run for this commit (0.18.2 crashed on both tarballs on 2026-10-16). Try a newer release before publishing.
- ✅ **Installed from these tarballs** into fresh apps from all four official starter kits: see [`docs/compatibility.md`](compatibility.md).

## 4. Provenance and the publish workflow

`provenance: true` means npm must be able to verify where each tarball was built, which only works from a supported CI (GitHub Actions here). A `pnpm publish` from a laptop fails with this setting, which is the point.

- ✅ **Workflow run without publishing** on `61dde23` with `version: 0.1.0-preview.0`, `publish: false`: [run 41453957618](https://github.com/mezielabs/azu/actions/runs/41453957618), all jobs green, publish skipped, artifact `preview-packages-61dde23…` uploaded (339,209 bytes).
- ✅ **Workflow prepared:** `.github/workflows/release.yml`, manual `workflow_dispatch` only. It calls the same CI workflow (lint/typecheck, database tests with the full browser suite in Chromium, budget, generator proof) and `smoke.yml`, the smoke subset in Firefox and WebKit (below). Only when both pass does it rebuild and inspect both packages from that commit.
- ✅ **Smoke subset in Firefox and WebKit (R02):** `apps/demo/tests/browser/smoke.spec.ts` signs in through the app's login page, then checks a list (rows, search, sort), a form save, a row action with a dialog field (Restock), and the Overview's widgets and range switch. `smoke.yml` runs it on SQLite in both engines (`node ace test browser --files tests/browser/smoke.spec.ts --browser=firefox`); the same file runs in Chromium with the full suite. Pull requests run `smoke.yml` only when the workflow or the spec changes.
- **Prepare without publishing:** dispatch on the intended branch with `version: 0.1.0-preview.0` and `publish: false` (default). It uploads `preview-packages-<commit>` containing both tarballs and the verification report. Stale tarballs or a mismatched version fail the check.
- **Publish only after owner approval:** dispatch from `main` with the matching version and `publish: true`. The publish job uses the `npm-preview` environment, requires a GitHub-hosted runner and an npm CLI supporting OIDC, and grants `id-token: write` only to that job. Configure environment protection/reviewers before enabling publication.
- It downloads and rechecks the inspected artifacts, then runs `npm publish <tarball> --tag preview --access public --provenance`, core first. pnpm has already rewritten workspace peers during packing; plain npm publishing of the source folders is not supported. No Git tag or GitHub release is created automatically.
- **If only core publishes:** the packages release together but registry operations are not atomic. Inspect the run and registry state before recovery; do not assume rerunning both publish commands succeeds over an existing version.
- Implementation references: [pnpm packing](https://pnpm.io/cli/pack), [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/), and [npm publish](https://docs.npmjs.com/cli/v11/commands/npm-publish/).
- ⬜ **(Chimezie)** **The `mezielabs` org on npm** exists, and the two package names are free or already in it.
- **The first publish needs a token.** A trusted publisher is set on the package's own settings page on npmjs.com (Packages → the package → Settings → Trusted publishing), which exists only once the package does, so trusted publishing can't make a package's first release. The publish step therefore takes an optional `NODE_AUTH_TOKEN` secret from the `npm-preview` environment and uses it only when it's set: it writes a temporary `.npmrc` for that run and publishes with the token (`--provenance` still applies, since the job runs in GitHub Actions with `id-token: write`). When the secret isn't set, the step unsets the empty variable and npm publishes through OIDC. npm tries OIDC first and falls back to a token, so a leftover token would also work, but it shouldn't be left there.
- ⬜ **(Chimezie)** **First publish (0.1.0-preview.0):** create a short-lived granular access token on npmjs.com that can publish `@mezielabs/azu` and `@mezielabs/azu-react` (2FA bypass for automation where npm asks for it), add it to the `npm-preview` environment as the secret `NODE_AUTH_TOKEN`, and run the workflow with `publish: true`. Delete the secret and revoke the token as soon as both packages are on npm.
- ⬜ **(Chimezie)** **Trusted publishing** then set up on npmjs.com for both packages, pointing at `mezielabs/azu`, `release.yml` and environment `npm-preview`. Later previews publish through OIDC with no token in the environment.
- ⬜ **(Chimezie)** Approve and run the workflow.
- ⬜ **After publishing:** both packages show a provenance badge on npmjs.com linking to the workflow run, and `npm view @mezielabs/azu dist-tags` shows `preview: 0.1.0-preview.0` with `latest` unset.

## 5. Changelog

- ✅ **`CHANGELOG.md`** has the unreleased `0.1.0-preview.0` entry for both packages, written from the merged PRs: the features (#37–#45, the earlier phases, and what came out of the 22 October review), with one line linking the review rather than a list of fixes to code no one has installed. Date it only after actual publication.

- ⬜ **README:** update the pre-release note at the top to say the preview is on npm, with `--tag preview` in the install command until `0.1.0`.

## 6. Checks before publishing

All on `61dde23`, 2026-11-02.

- ✅ **CI and the release workflow green** ([run 41453957618](https://github.com/mezielabs/azu/actions/runs/41453957618)):
  - Lint and typecheck: passed.
  - Core: 275 passed on each of SQLite, Postgres 18 and MySQL 8.4.
  - Demo: 329 passed, 1 skipped (README screenshots) on each database, the full browser suite in Chromium included; the generator proof's own run, 9 of 9, on each.
  - Smoke subset (`smoke.yml`): 5 of 5 in Firefox and 5 of 5 in WebKit.
  - One flaky browser test turned up afterwards, on SQLite in this PR's own CI: `save_and_continue.spec.ts` reads the save bar before the lazy form renders. Tracked in [#69](https://github.com/mezielabs/azu/issues/69).
- ✅ **`pnpm budget`:** initial admin JS 112.3 kB of 120 kB gz; the largest lazy page chunks are create and edit at 144.3 kB of 160 kB.
- ✅ **`pnpm prove:generator`:** passed for all 8 demo models (Category, Coupon, Order, OrderItem, Product, Setting, Tag, User) on each database in CI.
- ✅ **`node ace azu:doctor`** in the demo: 5 resources and 1 published page, 0 errors, 0 warnings.
- ✅ **`pnpm pack:check`:** passed (section 3).
- ⬜ **`pnpm bench:list`** on Postgres 18.6 with 100,040 products (seed plus `node ace bench:products --count=100000`), the demo built with `node ace build` and run with `NODE_ENV=production`, 200 sequential requests per scenario: 13 of 14 scenarios under the 200 ms p95 target (first page 54.2 ms, sort by price 55.4 ms, 100 per page 90.7 ms, five filters with a search 69.9 ms, page 1,000 of 3,000 103.7 ms). **One misses:** a search matching every row ("product"), p95 246.8 ms. Tracked in [#67](https://github.com/mezielabs/azu/issues/67).
- ✅ **`pnpm bench:widgets`** on the same database with 100,060 orders (`node ace bench:orders --count=100000`), 100 sequential requests per widget and range: worst p95 89.9 ms (Revenue over time, 90 days), under the 100 ms target; a second run's worst was 83.0 ms. The trend over 90 days has the least headroom.
- ✅ **The quickstart, with the tarballs from the release commit:** on the React starter kit, see [`docs/compatibility.md`](compatibility.md).

## 7. After publishing

- ⬜ The quickstart from npm, on a fresh starter kit, then time it again and update `docs/quickstart.md`. Check whether `node ace add` takes a dist-tag (`@mezielabs/azu@preview`); if it doesn't, the README's install step for the preview is `npm i @mezielabs/azu@preview @mezielabs/azu-react@preview`, then `node ace configure @mezielabs/azu`.
- ⬜ Announce to the early testers in the repo's Discussions, with the changelog entry and the quickstart.
