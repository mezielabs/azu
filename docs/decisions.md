# Decisions

Newest at the bottom. Each entry: date, decision, why.

- **2026-10-09 · Name: Azu, published as `@mezielabs/azu`.** Igbo for "back". The unscoped `azu` name and `@azu` scope are taken on npm, and the company scope builds Mezie Labs' authority. Front-end package: `@mezielabs/azu-react`.
- **2026-10-09 · React first.** Inertia + React 19 for v1. Vue waits for demand, so keep the component contract framework-neutral where it's cheap.
- **2026-10-09 · Inertia, not Edge.** Matches how most AdonisJS 7 apps are built and differentiates from adonis-admin (Edge-based).
- **2026-10-09 · Reuse app code for rules.** Permissions come from Bouncer policies and validation from VineJS validators named on each resource. Azu adds no rule system of its own.
- **2026-10-09 · Open core.** MIT core; Pro extensions as separate private packages that plug into core extension points. Pro licence checks happen at install and update, never at runtime.
- **2026-10-09 · Scope: AdonisJS 7 and Lucid only.** Postgres, MySQL, and SQLite supported.
- **2026-10-11 · Monorepo with pnpm workspaces.** `packages/core`, `packages/react`, `apps/demo`. Revisit in the spike if AdonisJS package tooling fights it.
