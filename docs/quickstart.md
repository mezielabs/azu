# Quickstart, timed

Phase 3's exit criterion (spec §11) is that the README quickstart works on a fresh app in under five minutes. This is a timed run of it, from a brand-new AdonisJS 7 Inertia React app to a working admin panel, and what it turned up.

**Run:** 2026-10-16, macOS on Apple silicon, Node 24.21.0, npm 11, SQLite (the starter kit's default), on a home connection.

## Result

From a fresh app to signing in at `/admin` and editing a record took **about 2 minutes**, roughly 1 minute of it commands and 1 minute of typing. Creating the app itself takes longer than adding Azu to it: 3 min 27 s, almost all of it the starter kit's `npm install`.

| Step | Command | Time |
| --- | --- | --- |
| Create the app (AdonisJS, before Azu) | `npx create-adonisjs@latest shop -K=react` | 3 min 27 s (npm install 3 min 19 s) |
| 1. Add Bouncer | `node ace add @adonisjs/bouncer` | 11 s |
| 2. Add Azu | `node ace add @mezielabs/azu` (see note) | 29 s to 60 s: install 24 to 55 s, configure 4.6 s |
| 3. Let yourself in | edit `accessAdmin` in `app/abilities/main.ts` | about 30 s by hand |
| 4. Generate a resource | `node ace make:admin-resource User --policy` | 1.5 s |
| 5. Start the dev server | `npm run dev` | ready in 3.2 s |
| 6. Sign up, open `/admin` | the starter kit's `/signup`, then `/admin/resources/users` | about 30 s by hand |

**Note on step 2:** Azu isn't on npm yet, so the run installed the two packages from tarballs (`pnpm pack` of `packages/core` and `packages/react`) with `npm install ../mezielabs-azu-0.0.0.tgz ../mezielabs-azu-react-0.0.0.tgz`, then ran `node ace configure @mezielabs/azu`. That's what `node ace add` does: install, then configure. Install time varied between two runs (24 s and 55 s) with the network; configure was the same both times.

## Steps

1. **Bouncer.** The React starter kit has auth and Lucid but not Bouncer, and Azu's access gate is a Bouncer ability. Add it before Azu, so the configure step can write `accessAdmin`:

   ```sh
   node ace add @adonisjs/bouncer
   ```

2. **Azu.** Install and configure it. Pass `--install` to also install `@mezielabs/azu-react` without being asked:

   ```sh
   node ace add @mezielabs/azu --install
   ```

   `node ace add` passes `--install` on to the configure step (checked with `node ace configure @mezielabs/azu --install true`, the form it forwards).

   It writes `config/admin.ts`, `start/admin.ts` and `inertia/admin/app.tsx`, registers the provider, commands and preload file, adds the `#admin/*` alias and the `azu()` Vite plugin, and adds `accessAdmin` to `app/abilities/main.ts`.

3. **Access.** `accessAdmin` returns `false`, so no one gets in yet. The starter kit's User has no role column, and its signup page is public, so letting every signed-in user in would let in anyone who registers. While you try Azu, let yourself in by email:

   ```ts
   import type User from '#models/user'

   export const accessAdmin = Bouncer.ability((user: User) => {
     return user.email === 'you@example.com'
   })
   ```

   Narrow it before the app goes anywhere, for example to a role you add. (The timed run used `return true`, which takes the same half a minute to type; the README and this step now check the email, because of the public signup.)

4. **A resource.** The starter kit's only model is User:

   ```sh
   node ace make:admin-resource User --policy
   ```

   It writes `app/admin/resources/user_resource.ts`, `app/policies/user_policy.ts` and, since `app/validators/user.ts` is the kit's own, `app/validators/user_admin.ts`. It warns that `password` is required but not an admin field, so users can't be created from the panel: correct, and the kit's signup page creates them.

5. **Run it.** `npm run dev`, sign up at http://localhost:3333/signup, then open http://localhost:3333/admin. Users is in the navigation, with a list, search, a detail page and an edit form that saves.

## What it turned up

- **Fixed: configure asked about a package that was already installed.** When `@mezielabs/azu-react` was already in `package.json` (installed alongside core, or a workspace package), configure still prompted to install it, or with `--no-install` printed "Please install `@mezielabs/azu-react`". It now checks `package.json` first and skips both. Tested in `packages/core/tests/configure.spec.ts`.
- **README: Bouncer comes first.** The README said to add Bouncer and then re-run configure if the app didn't have it. With the React starter kit that's always the case, so the README now says to add Bouncer before Azu.
- **README: an access rule for a fresh app.** The README's `accessAdmin` example uses `user.role`, which the starter kit's User doesn't have. The Installation section now shows an email check to use while trying it out. It doesn't suggest letting every signed-in user in, since the kits' signup is public.
- **README: try it with User.** The Quick start's `Product` model doesn't exist in a fresh app; the README now says to use `User` on one.
- **Not Azu's:** `npm run typecheck` on a fresh app with Bouncer fails on `#generated/policies` until the dev server or `node ace codegen` has run once. That's Bouncer's generated index, created by AdonisJS's codegen.

## Not covered by this run

- **The published packages:** installing from npm, and `node ace add` downloading them, wait for the 0.1.0 preview (`docs/release.md`).
- **Postgres and MySQL:** the run used the kit's SQLite. CI covers the other two in the demo.
