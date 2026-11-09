# Release checklist: 0.1.0-preview

The first preview of `@mezielabs/azu` and `@mezielabs/azu-react`, for early testers. **Verified on `61dde23`** (#59's merge into `main`), 2026-11-02: the figures below are from that commit, and replace earlier ones. Compatibility with each official starter kit is in [`docs/compatibility.md`](compatibility.md).

**Published 2026-11-03:** `0.1.0-preview.0` of both packages, from `141275c` (#73's merge into `main`) in [run 41597845479](https://github.com/mezielabs/azu/actions/runs/41597845479). npm staged the first publish: section 7 has what happened and how to approve a staged publish. Publishing, the `mezielabs` npm org and its trusted-publisher settings are Chimezie's to approve and do. The items marked **(Chimezie)** need him; the rest can be done in a PR.

Status: ✅ done and checked · ⬜ to do · **(Chimezie)** needs his approval or access

## Language scope

The preview ships an English built-in UI. There is no panel-wide locale or translation catalog, and the built-in strings do not pass through AdonisJS i18n. Supplied labels and validation messages can use the app's wording. Release notes must not claim full localization or translation-ready UI; that integration remains deferred.

## Known limits in the preview

Recorded from the compatibility pass and the benchmarks; both issues stay open for after the preview. The README lists them too.

- **Vue starter kit** ([#66](https://github.com/mezielabs/azu/issues/66)): Azu's admin is React beside the app's Vue pages, without `@vitejs/plugin-react`. In dev, admin pages log `GET /@react-refresh 404` and reload in full on an edit instead of hot-swapping, and the kit's `npm run typecheck` doesn't cover the admin's TSX (custom components and screen components). The admin works, and builds alongside the Vue app.
- **A search that matches every row** ([#67](https://github.com/mezielabs/azu/issues/67)): on 100,000 rows, p95 246.8 ms against the 200 ms target. Narrower searches, sorting, filtering and paging are well under it (section 6).

## 1. Version and tag

- ✅ **Version** both packages `0.1.0-preview.0`, in one commit. They release together: `@mezielabs/azu-react` has a peer dependency on `@mezielabs/azu`, written `workspace:^`, which `pnpm pack` rewrites to `^0.1.0-preview.0`.
- ✅ **npm dist-tag `preview`.** Published with `--tag preview`. On the first publish npm set `latest` to `0.1.0-preview.0` as well (section 7), so `npm install @mezielabs/azu` installs the preview until `latest` moves.
- ✅ **Git tag** `v0.1.0-preview.0` on the release commit (`141275c`), and a GitHub release (marked pre-release) with the changelog entry, published 2026-11-03.
- ⬜ **Later previews** bump the last number (`0.1.0-preview.1`). `0.1.0` itself is the Phase 3 release.

## 2. package.json fields

| Field | `@mezielabs/azu` | `@mezielabs/azu-react` | Needed |
| --- | --- | --- | --- |
| `name` | ✅ | ✅ | |
| `version` | ✅ `0.1.0-preview.1` | ✅ `0.1.0-preview.1` | Coordinated preview |
| `description` | ✅ | ✅ | |
| `license` | ✅ MIT, `LICENSE.md` shipped | ✅ MIT, `LICENSE.md` shipped | |
| `author` | ✅ Mezie Labs | ✅ Mezie Labs | |
| `repository` | ✅ | ✅ | **Required for provenance**: npm checks it against the repo that built the package. `{ "type": "git", "url": "git+https://github.com/mezielabs/azu.git", "directory": "packages/core" }` (and `packages/react`) |
| `homepage` | ✅ | ✅ | `https://azuadmin.com`, from the release after 0.1.0-preview.1; earlier versions show `https://github.com/mezielabs/azu#readme` on npm |
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
- **Deploy the docs first.** With `publish: true`, a `docs-live` job checks that https://azuadmin.com/docs/ answers 2xx, and `publish` waits for it. The packages, the README and Azu's setup messages (`E_AZU_SETUP`, configure's refusal) link to the docs, so the job fails with "Deploy the docs (apps/docs, pnpm docs:build) before publishing" until they're live. A dry run (`publish: false`) skips it.
- **Publish only after owner approval:** dispatch from `main` with the matching version and `publish: true`. The publish job uses the `npm-preview` environment, requires a GitHub-hosted runner and npm 11.15 or later for `npm stage publish` (Node 24.21 comes with npm 11.19, so the job doesn't install one), and grants `id-token: write` only to that job. Configure environment protection/reviewers before enabling publication.
- It downloads and rechecks the inspected artifacts, prints each tarball's full `shasum` and `integrity`, then runs `npm stage publish <tarball> --tag preview --access public --provenance`, core first. `npm stage publish` runs the same code as `npm publish` (npm's `StagePublish` extends `Publish`), so OIDC, `--tag`, `--access` and `--provenance` work as before; npm then holds each version, staged, until a maintainer approves it with 2FA, core first (section 7). pnpm has already rewritten workspace peers during packing; plain npm publishing of the source folders is not supported. No Git tag or GitHub release is created automatically.
- **If only core is staged:** the packages release together but registry operations are not atomic. Don't approve core on its own. Inspect the run and `npm stage list` before recovery, and reject what shouldn't go live; don't assume rerunning both commands succeeds over a version that's already staged.
- Implementation references: [pnpm packing](https://pnpm.io/cli/pack), [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/), [staged publishing](https://docs.npmjs.com/staged-publishing), and [npm stage](https://docs.npmjs.com/cli/v11/commands/npm-stage/).
- ✅ **(Chimezie)** **The `mezielabs` org on npm** exists, and both packages are in it.
- **No token.** The publish job stages through OIDC, with the trusted publishers set on each package's settings page on npmjs.com (Packages → the package → Settings → Trusted publishing), which allow `npm stage publish` only. The first publish needed a token, since those settings exist only once the package does; the workflow no longer reads `NODE_AUTH_TOKEN`.
- ✅ **(Chimezie)** **First publish (0.1.0-preview.0):** done 2026-11-03, and npm staged it (section 7). The steps were: create a short-lived granular access token on npmjs.com that can publish `@mezielabs/azu` and `@mezielabs/azu-react` (2FA bypass for automation where npm asks for it), add it to the `npm-preview` environment as the secret `NODE_AUTH_TOKEN`, and run the workflow with `publish: true`. Delete the secret and revoke the token as soon as both packages are on npm.
- ✅ **(Chimezie)** **Trusted publishing** set up on npmjs.com for both packages, pointing at `mezielabs/azu`, `release.yml` and environment `npm-preview`. They allow staging only (`npm stage publish`), not `npm publish`. The `npm-preview` environment holds no secrets.
- ✅ **(Chimezie)** Approve and run the workflow.
- ✅ **After publishing:** both packages carry a provenance attestation from the workflow run, and `npm view @mezielabs/azu dist-tags` shows `latest` and `preview`, both `0.1.0-preview.0` (section 7). Expect both on a package's first publish; the README installs with `@preview` either way.

## 5. Changelog

- ✅ **`CHANGELOG.md`** has the `0.1.0-preview.0` entry for both packages, dated 2026-11-03, the day it went live. It's written from the merged PRs: the features (#37–#45, the earlier phases, and what came out of the 22 October review), with one line linking the review rather than a list of fixes to code no one had installed.

- ✅ **README:** the note at the top says Azu is in preview (0.1.0-preview.0), and Installation installs with `@preview` until 0.1.0. The package READMEs match.

## 6. Checks before publishing

All on `61dde23`, 2026-11-02.

- ✅ **CI and the release workflow green** ([run 41453957618](https://github.com/mezielabs/azu/actions/runs/41453957618)):
  - Lint and typecheck: passed.
  - Core: 275 passed in each database's job. Those runs were all on in-memory SQLite, though: core's specs built their own SQLite database and ignored the job's database until #84 added `tests/helpers/test_database.ts`, which one spec uses so far. The demo suite below is what ran on each database. Moving the rest of core onto it is [#85](https://github.com/mezielabs/azu/issues/85).
  - Demo: 329 passed, 1 skipped (README screenshots) on each database, the full browser suite in Chromium included; the generator proof's own run, 9 of 9, on each.
  - Smoke subset (`smoke.yml`): 5 of 5 in Firefox and 5 of 5 in WebKit.
  - One flaky browser test turned up afterwards, on SQLite in this PR's own CI: `save_and_continue.spec.ts` reads the save bar before the lazy form renders. Fixed for [#69](https://github.com/mezielabs/azu/issues/69): the test waits for the bar, the browser suite waits for menus the same way, and the suite then passed 10 runs in a row on SQLite.
- ✅ **`pnpm budget`:** initial admin JS 112.3 kB of 120 kB gz; the largest lazy page chunks are create and edit at 144.3 kB of 160 kB.
- ✅ **`pnpm prove:generator`:** passed for all 8 demo models (Category, Coupon, Order, OrderItem, Product, Setting, Tag, User) on each database in CI.
- ✅ **`node ace azu:doctor`** in the demo: 5 resources and 1 published page, 0 errors, 0 warnings.
- ✅ **`pnpm pack:check`:** passed (section 3).
- ⬜ **`pnpm bench:list`** on Postgres 18.6 with 100,040 products (seed plus `node ace bench:products --count=100000`), the demo built with `node ace build` and run with `NODE_ENV=production`, 200 sequential requests per scenario: 13 of 14 scenarios under the 200 ms p95 target (first page 54.2 ms, sort by price 55.4 ms, 100 per page 90.7 ms, five filters with a search 69.9 ms, page 1,000 of 3,000 103.7 ms). **One misses:** a search matching every row ("product"), p95 246.8 ms. Tracked in [#67](https://github.com/mezielabs/azu/issues/67).
- ✅ **`pnpm bench:widgets`** on the same database with 100,060 orders (`node ace bench:orders --count=100000`), 100 sequential requests per widget and range: worst p95 89.9 ms (Revenue over time, 90 days), under the 100 ms target; a second run's worst was 83.0 ms. The trend over 90 days has the least headroom.
- ✅ **The quickstart, with the tarballs from the release commit:** on the React starter kit, see [`docs/compatibility.md`](compatibility.md).

## 7. After publishing

**The first publish** (2026-11-03, [run 41597845479](https://github.com/mezielabs/azu/actions/runs/41597845479) from `141275c`):

- **npm staged it.** The job ran `npm publish <tarball> --tag preview --access public --provenance` with the first-publish token, core first. Each package got a public `0.0.0-stage` placeholder at once (07:51 UTC), and `0.1.0-preview.0` stayed staged, not installable, until a maintainer approved it with 2FA: `@mezielabs/azu-react` at 07:55:01, `@mezielabs/azu` at 07:55:56. npm documents the placeholder for a package's first staged publish ([staged publishing](https://docs.npmjs.com/staged-publishing)).
- **Placeholders deprecated** by hand, so installing `0.0.0-stage` warns: "Placeholder from staged publishing. Install @mezielabs/azu@preview." (and `@mezielabs/azu-react@preview`).
- **Dist-tags:** `latest` and `preview` both `0.1.0-preview.0`, on both packages. A package's first publish sets `latest` even with `--tag preview`, as Verdaccio did (below); later previews published with `--tag preview` leave it where it is.
- **Integrity:** npm's `shasum` for each version matches the job log's: `5e4d5036…6e8d49` for `@mezielabs/azu`, `cf29429a…67c861` for `@mezielabs/azu-react`.
- **Provenance:** both versions carry an SLSA v1 provenance attestation, signed in the run and logged in Sigstore's transparency log.
- ✅ **Next preview:** trusted publishing stages too. The OIDC publish of 0.1.0-preview.1 staged both packages, as recorded under [0.1.0-preview.1](#010-preview1) below.

**Approving a staged publish.** You need npm 11.15 or later, 2FA on your npm account, and a session logged in as a maintainer (`npm login`). The `stage` subcommands other than `publish` can't use the job's OIDC token. Do this for each package, core first, since `@mezielabs/azu-react`'s peer range names core's version:

1. `npm stage list @mezielabs/azu` gives the staged version's stage id.
2. `npm stage view <stage-id>`: check the package name, the version, the tag (`preview`) and `staged by`, and that `shasum` matches the job's "Tarball checksums" step for that tarball (or, in runs before that step existed, the `npm notice shasum:` line under Tarball Details).
3. For a full-length check, `npm stage download <stage-id>` and compare the file with the job's log: `shasum -a 256 <downloaded .tgz>` against the `sha256` the "Recheck downloaded packages" step prints, or its sha512 against the full `integrity` the "Tarball checksums" step prints. (npm's own `integrity:` line is shortened, so it can't be compared in full.)
4. If anything differs, `npm stage reject <stage-id>` (2FA), and don't approve the other package.
5. `npm stage approve <stage-id>` (2FA). The version then goes live with the tag it was staged with. npmjs.com's Staged Packages tab has the same Approve button.

Then run `npm view @mezielabs/azu dist-tags` (and the same for `@mezielabs/azu-react`) to check the result.

**If staging fails with `ENEEDAUTH`.** From `npm stage publish` in the job, `ENEEDAUTH` usually means npm refused the OIDC exchange. Adding `--loglevel verbose` to the job's `npm stage publish` command shows npm's refusal. For 0.1.0-preview.1 the cause was an expired trusted publisher: npm expires a trusted-publisher configuration that isn't used within 2 days of being created. Create a package's trusted publisher just before its first OIDC publish, and if one has expired, recreate it (Packages → the package → Settings → Trusted publishing) with the same repository, workflow, environment and stage-only setting, then re-run the failed job.

**The install, checked before publishing** (2026-11-03) against a local registry: Verdaccio 7.0.2, with the tarballs `pnpm pack:check` built from `94bb98a`, published as `release.yml` does (`npm publish <tarball> --tag preview --access public`, core first, with `--provenance` off because provenance needs GitHub's OIDC token). They went into a fresh React starter kit (`create-adonisjs` 3.4.0, npm 11.19.0) whose `.npmrc` sent only the `@mezielabs` scope to Verdaccio.

- **Dist-tags:** `npm view @mezielabs/azu dist-tags` showed `{ latest: '0.1.0-preview.0', preview: '0.1.0-preview.0' }`, and the same for `@mezielabs/azu-react`. `--tag preview` didn't leave `latest` unset: Verdaccio points `latest` at a package's first version, and puts it back when it's removed. npmjs did the same on the first publish (above).
- **`npm i @mezielabs/azu@preview @mezielabs/azu-react@preview`, then `node ace configure @mezielabs/azu`:** installs both and configures, with no prompt for the React package, since it's already listed. This is the README's install step.
- **`node ace add @mezielabs/azu@preview`:** installs core, then fails with `Cannot find module "@mezielabs/azu@preview"` and exit 1. `ace add` (`@adonisjs/core` 7.6) passes the name, tag included, to `configure`, which imports it as a module name. Running `node ace configure @mezielabs/azu` afterwards finishes the install.
- **Plain `node ace add @mezielabs/azu`:** with `latest` set, as on Verdaccio and now on npmjs, it installs and configures the preview. Without `latest` it would fail at install with `ETARGET No matching version found`: npm's resolver finds no `latest`, and a prerelease doesn't match `*`. The README leaves it out until 0.1.0 anyway: later previews published with `--tag preview` leave `latest` behind on `0.1.0-preview.0`, so it would install the first preview.

- ⬜ The quickstart from npm, on a fresh starter kit, with the README's install step, then time it again and update `docs/quickstart.md`.
- ⬜ Announce to the early testers in the repo's Discussions, with the changelog entry and the quickstart.

## Deploying the docs

The docs site, `apps/docs`, is a static build on Cloudflare Workers at [azuadmin.com](https://azuadmin.com). `apps/docs/wrangler.jsonc` makes it a Worker with static assets only, no script. `/docs/installation` redirects to `/docs/installation/` (`html_handling: "force-trailing-slash"`), and an unknown path gets the site's 404 page with a 404 status.

Cloudflare Workers Builds deploys it. In the dashboard, connect `mezielabs/azu` to the `azu-docs` Worker under Settings › Builds:

| Setting | Value |
| --- | --- |
| Git branch | `main` |
| Root directory | Empty, the repository root |
| Build command | `pnpm install --frozen-lockfile && pnpm docs:build` |
| Deploy command | `npx wrangler deploy --config apps/docs/wrangler.jsonc` |
| Preview command | `npx wrangler preview --config apps/docs/wrangler.jsonc` |
| Build variables | `NODE_VERSION=24` |

- A push to `main` builds and deploys the site.
- With preview builds turned on, a push to any other branch runs the preview command instead. That branch gets its own preview URL, and production stays as it is.
- `wrangler preview` requires the `previews` block in `apps/docs/wrangler.jsonc`. It is empty because this site only uses top-level assets and compatibility settings. See [Cloudflare's preview configuration](https://developers.cloudflare.com/workers/previews/configuration/#wrangler-configuration-file).
- Wrangler isn't a dependency, so `npx` fetches it. Previews need Wrangler 4.135.0 or later, according to Cloudflare's docs.

Under the Worker's Settings › Domains & Routes, add `azuadmin.com` and `www.azuadmin.com` as custom domains. Then send www to the bare domain with a Redirect Rule in the `azuadmin.com` zone (Rules › Redirect Rules): `www.azuadmin.com` to `https://azuadmin.com`, keeping the path and query, with a 301.

The release workflow's `docs-live` job needs the site live. Before publishing, it checks that `https://azuadmin.com/docs/` answers 2xx, because the packages, the README and Azu's setup messages link there. Deploy the docs before you publish.

## 0.1.0-preview.1

The second preview: the #79 fix and the docs site (`CHANGELOG.md`). Both packages are versioned `0.1.0-preview.1` in one commit, and `pnpm pack:check` rewrites the React peer to `^0.1.0-preview.1`. The steps follow sections 4 and 7.

1. ✅ **Dry run:** [run 42478534170](https://github.com/mezielabs/azu/actions/runs/42478534170) on the release branch. Dispatch `release.yml` on the release branch with `version: 0.1.0-preview.1` and `publish: false`. The run needs `verify`, `smoke` and `packages` green, and the staging jobs skipped.
2. ✅ **(Chimezie)** **Publish:** after the release PR merges and the docs have deployed, dispatch `release.yml` from `main` with `version: 0.1.0-preview.1` and `publish: true`. `docs-live` checks that azuadmin.com answers, then the job stages both tarballs through OIDC.
3. ✅ **(Chimezie)** **Approve, core then React:** follow section 7's steps (`npm stage list`, `view`, and optionally `download`, then `approve`) for `@mezielabs/azu` first, then `@mezielabs/azu-react`.
4. ✅ **(Chimezie)** **Move `latest`:** staging with `--tag preview` leaves `latest` on `0.1.0-preview.0` (section 7). Run `npm dist-tag add @mezielabs/azu@0.1.0-preview.1 latest`, and the same for `@mezielabs/azu-react`, then check `npm view <package> dist-tags` shows both tags on `0.1.0-preview.1`.
5. ⬜ **Tag and release:** tag `v0.1.0-preview.1` on the release commit on `main` (`0877ee9`, the commit the publish run built), and publish a GitHub release (marked pre-release) with the changelog entry. Set the changelog entry's date to the day it went live.

**Result** (published 2026-11-09):

- **Run:** [run 42581837872](https://github.com/mezielabs/azu/actions/runs/42581837872), attempt 2, from `main` at `0877ee9`.
- **Did trusted publishing stage it?** Yes, as expected. The OIDC publish staged both packages, and Chimezie approved them with 2FA, core first: `@mezielabs/azu` went live at 08:23 UTC, `@mezielabs/azu-react` at 08:24.
- **Integrity:** npm's `shasum` matches the job's "Tarball checksums" step for both: `fcd88bcd9d96c5489ed1499e6a915e49b14b8993` for `@mezielabs/azu`, `c19ab4f85176f6a9116dd9f2a71e7aa3b557d710` for `@mezielabs/azu-react`.
- **Dist-tags after step 4:** `latest` and `preview` both `0.1.0-preview.1`, on both packages.
- **The first attempt failed with `ENEEDAUTH`.** The trusted publishers, created on 2026-11-03, had never been used, and npm expires a trusted-publisher configuration that isn't used within 2 days of being created. Chimezie recreated both on 2026-11-09 (`mezielabs/azu`, `release.yml`, environment `npm-preview`, `npm stage publish` only) and re-ran the failed job, which staged both packages. **Lesson:** create a trusted publisher just before its first OIDC publish. Section 7 has what to do if staging fails with `ENEEDAUTH`.
