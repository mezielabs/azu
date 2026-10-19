# Azu

Azu (Igbo for "back") is an admin panel for AdonisJS 7, published as `@mezielabs/azu` by [Mezie Labs](https://mezielabs.com). It reads an app's existing Lucid models, Bouncer policies, VineJS validators, and Drive disks, and renders an Inertia + React back office from small resource definitions. Free MIT core now; paid Pro extensions later.

Owner: Chimezie Enyinnaya (Mezie Labs). He makes product calls; you build.

## Read first

- `README.md` is the public API contract. Implement to match it.
- `docs/spec.md` has requirements (FR-01 to FR-19), non-functional targets, architecture, and milestones.
- `docs/decisions.md` records decisions already made. Add to it; don't relitigate it without a reason.

If the code forces a change to the API in `README.md` or `docs/spec.md`, update both in the same change and call it out in your summary. Never let them drift silently.

## Current phase

**Phase 2** (started 2026-10-15, after Phase 1 closed with #15). In order: FR-12 actions, FR-13 filters, FR-14 theming, one PR each, stopping for Chimezie's review after each. The P1 items (FR-09, FR-15, FR-16, FR-17) are a planning note in `docs/spec.md` §11 only; don't build them yet.

## Stack

- AdonisJS 7, Lucid, Bouncer, VineJS, Drive, Inertia
- React 19, React Aria Components, Tiptap 3 (lazy, optional peer), Tailwind for Azu's own prebuilt stylesheet
- TypeScript (strict), ESM, Node 24+
- Tests: Japa (unit, API client, browser client)
- Databases: Postgres (primary), MySQL, SQLite
- Monorepo: pnpm workspaces

## Layout

```
packages/core    @mezielabs/azu        provider, resource API, controllers, Ace commands (azu:*)
packages/react   @mezielabs/azu-react  Inertia pages and components
apps/demo        AdonisJS 7 + Inertia React store app; the test bed
docs/            spec, decisions, spike findings
```

## Commands

Run from the repo root. Root scripts build `packages/*` first, because the demo consumes their built output.

- Install: `pnpm install`
- First-time demo setup: `pnpm build` (the demo loads Azu's Ace commands from the built package), then `cp apps/demo/.env.example apps/demo/.env && pnpm --filter demo exec node ace generate:key`, then `pnpm demo:seed`
- Build packages: `pnpm build`
- Typecheck: `pnpm typecheck` (packages, then the demo; the demo runs `node ace codegen` first)
- Lint: `pnpm lint`
- Test: `pnpm test` (core Japa suite, then the demo's `node ace test`)
- Test on Postgres or MySQL: set `DB_CONNECTION=pg` (or `mysql`) and `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE` (see `apps/demo/.env.example`), then `pnpm test`. CI runs Postgres 18, MySQL 8.4 and SQLite (`.github/workflows/ci.yml`).
- Run demo: `pnpm dev` (`node ace serve --hmr`), then open http://localhost:3333/admin. Needs Node 24.21 or later (`engines` in every package.json); `--hmr` and `sanitize-html` crash on 24.3.0. `.nvmrc` pins 24.21.
- Reset and seed the demo DB: `pnpm demo:seed`. Logins are in `apps/demo/database/seeders/main_seeder.ts`.
- Regenerate `apps/demo/database/schema.ts` after a migration change: run migrations against Postgres (`DB_CONNECTION=pg … node ace migration:run`). Schema generation is on for Postgres only, so its types match the primary database, and CI fails if the committed file differs.
- README screenshots: `pnpm screenshots` with the Postgres settings above (`DB_CONNECTION=pg` and `DB_*`). A skipped-by-default browser test seeds the demo and writes `docs/screenshots/*.png`, light and dark, and refuses to run on another database, since SQLite drops decimals' trailing zeros. Re-run it when the list or form changes visibly.
- Admin bundle budget: `pnpm budget` (production build of the demo, then `scripts/check_admin_bundle.mjs`; CI runs it)
- List performance (spec §2, before each release): on Postgres, `node ace migration:fresh --seed` and `node ace bench:products --count=100000` in `apps/demo`, start the demo with `NODE_ENV=production`, then `pnpm bench:list <url>`
- Format: `pnpm format`
- Azu's own Ace commands, in the app: `node ace azu:resource`, `azu:action`, `azu:publish`, `azu:doctor`. No `make:`/`admin:` aliases; a core test fails if the old names reappear outside `docs/decisions.md`.

## Non-negotiables

1. **One source of truth.** Azu never defines its own permission or validation rules. It calls the app's Bouncer policies and VineJS validators.
2. **Server-side authorisation, always.** Hiding UI is a convenience. Every route and action checks the policy on the server, including each record in a bulk action. A missing policy method means denied.
3. **Mass assignment** is limited to declared fields before validation.
4. **No N+1 queries.** Relations shown in columns are preloaded.
5. **Typed against the model.** Misspelled column or field names must fail `tsc`.
6. **Admin code stays on `/admin`.** Separate Vite entry; zero weight on the app's public pages.
7. **Everything overridable** without forking: config, component swap, page publish.
8. **Core never imports Pro code.** Expose extension points instead.

These keep a Vue front end (`@mezielabs/azu-vue`) cheap to add later:

9. **Style Azu's own hooks.** Azu's stylesheet targets Azu's own classes, data attributes, and CSS variables, never React Aria's data attributes.
10. **Contracts live in core.** Page prop types and the field component contract (`FieldProps`) live in `@mezielabs/azu`. `@mezielabs/azu-react` re-exports them; it doesn't define them.
11. **Logic outside components.** Formatting, URL state, and filter encoding live in plain TypeScript modules, not inside React components.
12. **No React Aria or Tiptap types in the public API.**

## Verify, don't recall

AdonisJS 7, Inertia, React 19, VineJS, and Bouncer APIs change. Before relying on an API, check the official docs (docs.adonisjs.com, vinejs.dev, inertiajs.com) or the installed source in `node_modules`. If you can't confirm something, say so rather than guessing. Use the AdonisJS package starter kit and `node ace configure` conventions rather than inventing your own provider and configure patterns.

## Conventions

- AdonisJS naming: snake_case file names, PascalCase classes, `#` subpath imports in the demo app.
- Use the official AdonisJS ESLint and Prettier configs.
- Conventional Commits (`feat(core): …`, `fix(react): …`). Reference FR IDs where relevant.
- Small, reviewable changes: one FR or one concern per branch or PR.
- Public APIs get TSDoc comments; they'll generate the reference docs.

## Definition of done

A requirement is done when:

- it meets its acceptance criteria in `docs/spec.md`
- it has tests, including a forbidden-path test for anything permission-related
- it's exercised in `apps/demo` (if the demo doesn't show it, it isn't done)
- typecheck, lint, and tests pass
- `README.md` and `docs/spec.md` still match the behaviour

## Ask Chimezie before

- changing the public API in `README.md`
- adding a runtime dependency to `packages/core` or `packages/react`
- starting a new phase or pulling P1/P2 work forward
- anything touching npm publishing, the `mezielabs` org, or licensing

Otherwise, make the reasonable call, record it in `docs/decisions.md` if it's non-obvious, and keep going.
