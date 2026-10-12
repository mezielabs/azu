# Decisions

Newest at the bottom. Each entry: date, decision, why.

- **2026-10-09 · Name: Azu, published as `@mezielabs/azu`.** Igbo for "back". The unscoped `azu` name and `@azu` scope are taken on npm, and the company scope builds Mezie Labs' authority. Front-end package: `@mezielabs/azu-react`.
- **2026-10-09 · React first.** Inertia + React 19 for v1. Vue waits for demand, so keep the component contract framework-neutral where it's cheap.
- **2026-10-09 · Inertia, not Edge.** Matches how most AdonisJS 7 apps are built and differentiates from adonis-admin (Edge-based).
- **2026-10-09 · Reuse app code for rules.** Permissions come from Bouncer policies and validation from VineJS validators named on each resource. Azu adds no rule system of its own.
- **2026-10-09 · Open core.** MIT core; Pro extensions as separate private packages that plug into core extension points. Pro licence checks happen at install and update, never at runtime.
- **2026-10-09 · Scope: AdonisJS 7 and Lucid only.** Postgres, MySQL, and SQLite supported.
- **2026-10-11 · Monorepo with pnpm workspaces.** `packages/core`, `packages/react`, `apps/demo`. Revisit in the spike if AdonisJS package tooling fights it.
- **2026-10-11 · Monorepo tooling confirmed in the spike.** pnpm workspaces work with the AdonisJS package tooling (tsdown, ts-exec, Japa). Core builds with tsdown per the AdonisJS package starter kit; `@mezielabs/azu-react` builds with `tsc` plus the Tailwind CLI and ships `src/` for `admin:publish`. The demo consumes built output, so root scripts build packages first.
- **2026-10-11 · Demo runs on SQLite during the spike.** It's the starter kit default and needs no server. Postgres (primary) and MySQL come with the Phase 1 integration suite.
- **2026-10-11 · Root `pnpm dev` uses `node ace serve --watch`, not `--hmr`.** `--hmr` crashes in a ts-exec loader hook on Node 24.3.0 even in the unmodified starter. Revisit once local Node is upgraded.
- **2026-10-12 · `pnpm dev` back on `--hmr`; local Node is 24.21.0.** The `--hmr` crash was Node 24.3.0, not Azu or the starter: on 24.21.0 the dev server boots, serves `/admin`, and survives a backend hot reload. `.nvmrc` pins Node 24. Supersedes the `--watch` entry above.
