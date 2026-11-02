# Compatibility: the official starter kits

Fresh installs of `0.1.0-preview.0`, from the tarballs packed on `61dde23` (#59's merge into `main`), into new AdonisJS 7 apps from each official starter kit. Run on 2026-11-02.

## Summary

**Works today**

- **React (Inertia) kit:** the documented steps reach a working `/admin` with a generated resource and the Overview screen, with no changes to the app's own code beyond the README's (the `accessAdmin` rule, `home`). About 1 minute of Azu commands on top of creating the app.
- **Vue (Inertia) kit:** the same steps work. The React admin entry and the app's Vue plugin build together: one `node ace build` emits both entries, and the app's pages load only their own.
- **SSR:** with the app's Inertia SSR on for every page, the app's pages render on the server and `/admin` renders in the browser, as #60 intended. Confirmed on a production build of the React kit.
- **CSP:** with Shield's CSP on and a strict nonce policy, the panel works. Azu's no-flash theme script and theme style carry the request's nonce.
- **The app's public pages never load admin code**, on every kit checked (React, Vue, Hypermedia).

**Needs a fix before the preview**

- [#64](https://github.com/mezielabs/azu/issues/64): `/admin` is a 500 (`TypeError: … reading 'ssr'`) in an app without Inertia's config, such as the Hypermedia kit. It should be a clear message instead.
- [#63](https://github.com/mezielabs/azu/issues/63): configure doesn't check for Vite, Edge, Inertia or a session guard before writing files. It reports success on the Hypermedia kit, and fails halfway on the API kit.
- [#65](https://github.com/mezielabs/azu/issues/65): under a strict CSP, React Aria's runtime styles are blocked, because the admin view has no `csp-nonce` meta. One inline style from the React DOM chunk is blocked too. Nothing visible broke.

**Known limits in the preview** (recorded in the README and `docs/release.md`; fixed after the preview)

- [#66](https://github.com/mezielabs/azu/issues/66): on the Vue kit there's no React Fast Refresh for the admin (`/@react-refresh` 404s in dev), and `npm run typecheck` skips the admin's TSX.
- [#67](https://github.com/mezielabs/azu/issues/67): a list search matching all 100,000 rows has a p95 of 246.8 ms, against the 200 ms target ([release checklist](release.md), section 6).

**Unsupported for the preview (documented)**

- **Hypermedia (Edge) kit:** works only after two manual steps: add `config/inertia.ts` and register `@adonisjs/inertia/inertia_provider`. `@adonisjs/inertia` 5 has no configure hook, so `node ace add` can't do it. Supported in the sense that it works; not supported by `configure` until #63.
- **API kit:** no browser sign-in. Its default guard is access tokens, its only login is a JSON endpoint, and it has no Vite or Edge. Vite, Edge and Inertia can be added for `/admin` alone (below), but a working panel needs a session login page the app doesn't have. Unsupported for the preview.

## Setup

macOS 26.6 (x86_64), Node 24.21.0, npm 11.19.0, `create-adonisjs` 3.4.0. The kits installed `@adonisjs/core` 7.6.0, `@adonisjs/inertia` 5.0.5, `@adonisjs/vite` 6.0.4, Vite 8.3.5, `@adonisjs/bouncer` 4.0.1, `@adonisjs/shield` 9.0.0, React 19.3.1, `@inertiajs/react` 3.11.0 and Vue 3.5.44, with SQLite (each kit's default).

Each app followed the README's Installation and Quick start, with the tarballs in place of the registry:

1. `npx create-adonisjs@3.4.0 <app> --kit=<kit> --pkg=npm`
2. `node ace add @adonisjs/bouncer`
3. `npm install <mezielabs-azu-0.1.0-preview.0.tgz> <mezielabs-azu-react-0.1.0-preview.0.tgz>`, then `node ace configure @mezielabs/azu` (what `node ace add @mezielabs/azu` does once the packages are on npm)
4. `accessAdmin` lets in one test email; `node ace azu:resource User --policy`; `node ace azu:screen Overview`; `home: 'overview'` in `config/azu.ts`
5. `node ace codegen`, then the kit's `npm run typecheck`
6. `node ace serve --hmr`, sign up through the kit's page, then `/admin`, `/admin/resources/users` and a user's edit page

Times are wall clock, on a home connection; `npm install` steps vary with the network.

## React (Inertia)

| Step | Time | Result |
| --- | --- | --- |
| Create the app | 174 s | ✅ |
| Add Bouncer | 15 s | ✅ |
| Install the tarballs | 22 s | ✅ |
| `node ace configure @mezielabs/azu` | 5 s | ✅ writes `config/azu.ts`, `start/azu.ts`, `inertia/admin/app.tsx`; updates `adonisrc.ts`, `package.json` (`#admin/*`), `vite.config.ts` (`azu()`), `app/abilities/main.ts` (`accessAdmin`) |
| `azu:resource User --policy` | 1 s | ✅ policy, `app/validators/user_admin.ts` (the kit has its own `user.ts`), resource; warns that `password` isn't an admin field, so users can't be created from the panel |
| `azu:screen Overview` | under 1 s | ✅ |
| Typecheck | 8 s | ✅ after `node ace codegen` |
| `/admin` | | ✅ guests get a 302 to `/login`; after signing up: the Overview at `/admin`, Users in the navigation, the list and the edit form; no console errors |

**Note:** the kit's `npm run typecheck` fails before `node ace codegen` (or a first `node ace serve`) has written `#generated/policies`, which Bouncer's middleware imports. That's AdonisJS's codegen, not Azu, but a quickstart reader who typechecks first will hit it.

### CSP (Shield)

The React app's production build (`node ace build`, `NODE_ENV=production`), with Shield's CSP enabled:

```ts
directives: {
  defaultSrc: [`'self'`],
  scriptSrc: [`'self'`, '@nonce'],
  styleSrc: [`'self'`, '@nonce'],
  imgSrc: [`'self'`, 'data:'],
  fontSrc: [`'self'`, 'data:'],
  connectSrc: [`'self'`],
}
```

- ✅ The header is sent, and `admin.edge`'s inline theme script and theme style get the request's nonce (`cspNonce`). The theme applies, and the Overview, the Users list and a row menu work.
- ⚠️ Two runtime `<style>` injections are blocked (`style-src-elem`), seen while opening the list and a row menu: React Aria's, which reads its nonce from a `<meta property="csp-nonce">` that `admin.edge` doesn't emit, and one from the React DOM chunk, not yet identified. [#65](https://github.com/mezielabs/azu/issues/65).
- Dev (`node ace serve`) under the same policy also blocks Vite's own client (its websocket and injected styles). That's Vite's dev server, not Azu: test CSP on a production build.

### SSR

The same app with `ssr.enabled: true` and no `pages` filter, so every page renders on the server. The kit also needs `serverEntryPoints: ['inertia/ssr.tsx']` on the `adonisjs()` Vite plugin, or Vite builds no SSR bundle. That's the app's own SSR setup, not Azu's.

- ✅ The app's `/login` is server-rendered (`<div data-server-rendered="true" id="app">` with the form in the HTML).
- ✅ `/admin` and `/admin/resources/users` return 200 with an empty `<div id="app"></div>` and the `azu/…` page in the JSON, so they render in the browser (#60).

## Vue (Inertia)

| Step | Time | Result |
| --- | --- | --- |
| Create the app | 84 s | ✅ |
| Add Bouncer | 11 s | ✅ |
| Install the tarballs | 18 s | ✅ npm installs Azu's React peers itself (React 19.3.1, `@inertiajs/react` 3.11.0) |
| Configure | 4 s | ✅ same files as React; `azu()` added beside `vue()` |
| Resource, screen | about 1 s | ✅ |
| Typecheck | | ✅, but it doesn't cover the admin: the kit's `inertia/tsconfig.json` has `jsxImportSource: "vue"` and includes only `.ts` and `.vue` files |
| `node ace build` | 9 s | ✅ two entries: `inertia/app.ts` (Vue) and `inertia/admin/app.tsx` (React), the admin compiled with React's JSX runtime |
| `/admin` in dev | | ✅ the Overview, Users, the edit form; the app's pages load only `inertia/app.ts` |

⚠️ No `@vitejs/plugin-react`, so each admin page load logs `GET /@react-refresh 404`, and editing an admin component reloads the page instead of hot-swapping it. [#66](https://github.com/mezielabs/azu/issues/66), with the typecheck gap.

## Hypermedia (Edge)

| Step | Time | Result |
| --- | --- | --- |
| Create the app | 26 s | ✅ |
| Add Bouncer | 50 s | ✅ |
| Install the tarballs | 30 s | ✅ npm installs `@adonisjs/inertia` 5.0.5 and React as peers |
| Configure | 4 s | ⚠️ reports success, with the same files as React, though the app has no Inertia provider or `config/inertia.ts` ([#63](https://github.com/mezielabs/azu/issues/63)) |
| Resource, screen, typecheck | | ✅ |
| `/admin` | | ❌ 500 for everyone: `TypeError: Cannot read properties of undefined (reading 'ssr')` in `AdminInertiaMiddleware` ([#64](https://github.com/mezielabs/azu/issues/64)) |

**Adding Inertia for `/admin` alone, without touching the app's pages:** `node ace configure @adonisjs/inertia` doesn't work ("The module does not export the configure hook"). By hand:

1. Add `config/inertia.ts` (`defineConfig({ ssr: { enabled: false, entrypoint: 'inertia/ssr.tsx' } })`). Then guests get the 302 to `/login`, but `/admin` renders `@inertiaHead() @inertia()` as text.
2. Register `() => import('@adonisjs/inertia/inertia_provider')` in `adonisrc.ts`, which provides those Edge tags.

✅ Then `/admin` works: the Overview, Users and the edit form, signed in through the kit's Edge signup page. The app's own Edge pages are unchanged and still load only `resources/css/app.css` and `resources/js/app.js`. No `@vitejs/plugin-react` is needed; the same Fast Refresh 404 applies as on Vue.

## API

| Step | Time | Result |
| --- | --- | --- |
| Create the app | 75 s | ✅ |
| Add Bouncer | 30 s | ✅ |
| Install the tarballs | 52 s | ✅ npm installs Vite, `@adonisjs/vite`, Edge and `@adonisjs/inertia` as peers |
| Configure | 5 s | ❌ exit 1 at `update vite.config.ts file`: "Cannot find vite.config.ts file". The config, preload and admin entry were already written ([#63](https://github.com/mezielabs/azu/issues/63)) |

**Adding what `/admin` needs, without touching the app's routes:**

1. `node ace configure @adonisjs/vite` (5 s): `config/vite.ts`, `vite.config.ts`, the provider and its middleware.
2. `node ace configure edge` (5 s): the provider.
3. `config/inertia.ts` and the Inertia provider, by hand as on Hypermedia.
4. `node ace configure @mezielabs/azu` again (6 s): it skips everything already written and adds `azu()` to `vite.config.ts`. Running it twice is safe.
5. `guard: 'web'` in `config/azu.ts`: the kit's default guard is access tokens (`api`), and the panel needs the session one.

The resource and screen generate and typecheck, the app boots, and guests get the 302 to `/login`. **But `/login` is a 404:** the kit's only login is `POST /api/v1/auth/login`, which issues tokens. A working panel needs a session login page the app would have to add, so the API kit is unsupported for the preview.
